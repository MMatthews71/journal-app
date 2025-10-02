from flask import Flask, send_from_directory, jsonify
import os
import webbrowser
import sys
from api import api_bp  # Import the API blueprint

app = Flask(__name__, static_folder='.', static_url_path='')

# Register the API blueprint
app.register_blueprint(api_bp)

# Debug function to list all routes
@app.route('/routes')
def list_routes():
    output = []
    for rule in app.url_map.iter_rules():
        methods = ','.join(rule.methods)
        line = f"{rule.endpoint}: {rule.rule} [{methods}]"
        output.append(line)
    return jsonify({'routes': sorted(output)})

@app.route('/')
def serve_index():
    """Serve the main index.html file"""
    return send_from_directory('.', 'index.html')

@app.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'endpoints': [
            {'path': '/', 'methods': ['GET']},
            {'path': '/health', 'methods': ['GET']},
            {'path': '/api/journal/entries', 'methods': ['GET']},
            {'path': '/api/journal/entry', 'methods': ['POST']}
        ]
    })

# Test route
@app.route('/test')
def test_route():
    return jsonify({'status': 'success', 'message': 'Test route is working!'})

# CORS headers middleware
@app.after_request
def add_cors_headers(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# Get desktop path and create data folder
desktop_path = os.path.join(os.path.expanduser('~'), 'Desktop')
data_folder = os.path.join(desktop_path, 'MindfulJournalData')

# Ensure data folder exists
if not os.path.exists(data_folder):
    os.makedirs(data_folder)
    print(f"Created data folder: {data_folder}")

def ensure_data_folder():
    """Create data folder if it doesn't exist"""
    if not os.path.exists(data_folder):
        os.makedirs(data_folder)
        print(f"Created data folder: {data_folder}")
    
    # Create subfolders for better organization
    subfolders = ['active', 'completed']
    for folder in subfolders:
        folder_path = os.path.join(data_folder, folder)
        if not os.path.exists(folder_path):
            os.makedirs(folder_path)

def get_file_path(data_type, status='active'):
    """Get file path for different data types and status"""
    filename = f"{status}_{data_type}.json"
    return os.path.join(data_folder, status, filename)

def load_data(data_type, status='active'):
    """Load data from file"""
    file_path = get_file_path(data_type, status)
    try:
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading {data_type} data: {e}")
    return []

def save_data(data_type, data, status='active'):
    """Save data to file"""
    file_path = get_file_path(data_type, status)
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving {data_type} data: {e}")
        return False
        

def move_data(data_type, item_id, from_status, to_status):
    """Move data between active and completed"""
    # Load from source
    source_data = load_data(data_type, from_status)
    target_data = load_data(data_type, to_status)
    
    # Find and move item
    item_to_move = None
    new_source_data = []
    
    for item in source_data:
        if item.get('id') == item_id:
            item_to_move = item
        else:
            new_source_data.append(item)
    
    if item_to_move:
        # Update completion timestamp
        item_to_move['completed_at'] = datetime.now().isoformat()
        target_data.append(item_to_move)
        
        # Save both files
        save_data(data_type, new_source_data, from_status)
        save_data(data_type, target_data, to_status)
        return True
    
    return False

# Serve index.html for the root URL
@app.route('/')
def index():
    return send_file('index.html')

# Serve other static files (CSS, JS, etc.)
@app.route('/<path:path>')
def static_files(path):
    if os.path.exists(path):
        return send_file(path)
    return send_file('index.html')  # Fallback to index.html for SPA routing

@app.route('/api/<data_type>', methods=['GET'])
def get_data(data_type):
    """Get both active and completed data"""
    ensure_data_folder()
    
    if data_type not in ['goals', 'tasks']:
        return jsonify({'error': 'Invalid data type'}), 400
    
    active_data = load_data(data_type, 'active')
    completed_data = load_data(data_type, 'completed')
    
    return jsonify({
        'active': active_data,
        'completed': completed_data
    })

@app.route('/api/<data_type>/active', methods=['POST'])
def add_active_data(data_type):
    """Add new active item"""
    if data_type not in ['goals', 'tasks']:
        return jsonify({'error': 'Invalid data type'}), 400
    
    item_data = request.get_json()
    if not item_data:
        return jsonify({'error': 'No data provided'}), 400
    
    active_data = load_data(data_type, 'active')
    active_data.append(item_data)
    
    if save_data(data_type, active_data, 'active'):
        return jsonify({'success': True, 'item': item_data})
    else:
        return jsonify({'error': 'Failed to save data'}), 500

@app.route('/api/<data_type>/<item_id>/complete', methods=['POST'])
def complete_item(data_type, item_id):
    """Move item from active to completed"""
    if data_type not in ['goals', 'tasks']:
        return jsonify({'error': 'Invalid data type'}), 400
    
    if move_data(data_type, item_id, 'active', 'completed'):
        return jsonify({'success': True})
    else:
        return jsonify({'error': 'Item not found'}), 404

@app.route('/api/<data_type>/<item_id>/reactivate', methods=['POST'])
def reactivate_item(data_type, item_id):
    """Move item from completed to active"""
    if data_type not in ['goals', 'tasks']:
        return jsonify({'error': 'Invalid data type'}), 400
    
    if move_data(data_type, item_id, 'completed', 'active'):
        return jsonify({'success': True})
    else:
        return jsonify({'error': 'Item not found'}), 404

@app.route('/api/<data_type>/<item_id>', methods=['PUT'])
def update_item(data_type, item_id):
    """Update an item (can be in active or completed)"""
    if data_type not in ['goals', 'tasks']:
        return jsonify({'error': 'Invalid data type'}), 400
    
    updated_data = request.get_json()
    if not updated_data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Try to find and update in active first
    active_data = load_data(data_type, 'active')
    for i, item in enumerate(active_data):
        if item.get('id') == item_id:
            active_data[i] = updated_data
            if save_data(data_type, active_data, 'active'):
                return jsonify({'success': True})
    
    # If not in active, try completed
    completed_data = load_data(data_type, 'completed')
    for i, item in enumerate(completed_data):
        if item.get('id') == item_id:
            completed_data[i] = updated_data
            if save_data(data_type, completed_data, 'completed'):
                return jsonify({'success': True})
    
    return jsonify({'error': 'Item not found'}), 404

@app.route('/api/<data_type>/<item_id>', methods=['DELETE'])
def delete_item(data_type, item_id):
    """Delete an item from active or completed"""
    if data_type not in ['goals', 'tasks']:
        return jsonify({'error': 'Invalid data type'}), 400
    
    # Try to delete from active first
    active_data = load_data(data_type, 'active')
    new_active_data = [item for item in active_data if item.get('id') != item_id]
    
    if len(new_active_data) < len(active_data):
        if save_data(data_type, new_active_data, 'active'):
            return jsonify({'success': True})
    
    # If not in active, try completed
    completed_data = load_data(data_type, 'completed')
    new_completed_data = [item for item in completed_data if item.get('id') != item_id]
    
    if len(new_completed_data) < len(completed_data):
        if save_data(data_type, new_completed_data, 'completed'):
            return jsonify({'success': True})
    
    return jsonify({'error': 'Item not found'}), 404

@app.route('/api/system/info', methods=['GET'])
def get_system_info():
    # Get information about data storage
    try:
        total_size = 0
        file_count = 0
        
        for status in ['active', 'completed']:
            status_path = os.path.join(data_folder, status)
            if os.path.exists(status_path):
                for filename in os.listdir(status_path):
                    if filename.endswith('.json'):
                        file_path = os.path.join(status_path, filename)
                        total_size += os.path.getsize(file_path)
                        file_count += 1
        
        return jsonify({
            'data_folder': data_folder,
            'total_size': total_size,
            'file_count': file_count,
            'status': 'success'
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# Journal Entry Endpoints

def get_journal_entry_path(entry_type, entry_id):
    """Get file path for a specific journal entry"""
    journal_folder = os.path.join(data_folder, 'journal')
    if not os.path.exists(journal_folder):
        os.makedirs(journal_folder)
    
    type_folder = os.path.join(journal_folder, entry_type)
    if not os.path.exists(type_folder):
        os.makedirs(type_folder)
    
    return os.path.join(type_folder, f"{entry_id}.txt")

@app.route('/api/journal/entries', methods=['GET', 'OPTIONS'])
def get_journal_entries():
    """Get all journal entries"""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'success'}), 200
        
    try:
        all_entries = []
        journal_folder = os.path.join(data_folder, 'journal')
        
        # Create journal folder if it doesn't exist
        if not os.path.exists(journal_folder):
            os.makedirs(journal_folder)
            return jsonify([])
            
        for entry_type in os.listdir(journal_folder):
            type_folder = os.path.join(journal_folder, entry_type)
            if os.path.isdir(type_folder):
                for filename in os.listdir(type_folder):
                    if filename.endswith('.txt'):
                        entry_id = filename[:-4]  # Remove .txt extension
                        entry_path = os.path.join(type_folder, filename)
                        try:
                            with open(entry_path, 'r', encoding='utf-8') as f:
                                content = f.read()
                                # Get creation and modification times
                                stat = os.stat(entry_path)
                                created = stat.st_ctime
                                updated = stat.st_mtime
                                
                                all_entries.append({
                                    'id': entry_id,
                                    'content': content,
                                    'type': entry_type,
                                    'created': created * 1000,  # Convert to milliseconds for JavaScript
                                    'updated': updated * 1000
                                })
                        except Exception as e:
                            print(f"Error reading {entry_path}: {e}")
        
        # Sort entries by updated date (newest first)
        all_entries.sort(key=lambda x: x.get('updated', 0), reverse=True)
        
        response = jsonify(all_entries)
        return response
    except Exception as e:
        print(f"Error in get_journal_entries: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to load journal entries: {str(e)}'
        }), 500

@app.route('/api/journal/entry', methods=['POST', 'OPTIONS'])
def save_journal_entry():
    """Save or update a journal entry"""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'success'}), 200
        
    try:
        # Log the incoming request data
        print(f"Received request with data: {request.data}")
        
        if not request.is_json:
            return jsonify({'status': 'error', 'message': 'Request must be JSON'}), 400
            
        entry_data = request.get_json()
        print(f"Parsed JSON data: {entry_data}")
        
        if not entry_data:
            return jsonify({'status': 'error', 'message': 'No data provided'}), 400
        
        entry_type = entry_data.get('type', 'personal')
        entry_id = entry_data.get('id') or str(int(datetime.now().timestamp() * 1000))
        
        print(f"Processing entry - ID: {entry_id}, Type: {entry_type}")
        
        # Create the entry path
        entry_path = get_journal_entry_path(entry_type, entry_id)
        print(f"Saving to: {entry_path}")
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(entry_path), exist_ok=True)
        
        # Save content to text file
        content = entry_data.get('content', '')
        with open(entry_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        # Update the file's modification time if this is an update
        if entry_data.get('updated'):
            updated_time = entry_data['updated'] / 1000  # Convert from ms to seconds
            os.utime(entry_path, (updated_time, updated_time))
        
        response_data = {
            'status': 'success',
            'id': entry_id,
            'message': 'Entry saved successfully',
            'path': entry_path
        }
        print(f"Success response: {response_data}")
        
        return jsonify(response_data)
    except Exception as e:
        error_msg = f'Failed to save entry: {str(e)}'
        print(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500

if __name__ == '__main__':
    # Print all registered routes
    print("\nRegistered routes:")
    for rule in app.url_map.iter_rules():
        print(f"{rule.endpoint}: {rule.rule} [{', '.join(rule.methods)}]")
    
    url = 'http://localhost:5000/'
    
    # Only open browser if not in production
    if '--no-browser' not in sys.argv and '--help' not in sys.argv:
        import threading
        import time
        
        def open_browser():
            time.sleep(1)  # Give the server a moment to start
            webbrowser.open(url)
        
        threading.Thread(target=open_browser).start()
    
    print(f"\nData will be stored in: {data_folder}")
    print("Starting server...")
    # Run the app with debug mode but without the reloader
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)