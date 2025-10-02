from flask import Blueprint, jsonify, request
import os
from datetime import datetime

# Create a Blueprint for our API endpoints
api_bp = Blueprint('api', __name__, url_prefix='/api')

# Get the data folder path
desktop_path = os.path.join(os.path.expanduser('~'), 'Desktop')
data_folder = os.path.join(desktop_path, 'MindfulJournalData')

def get_journal_entry_path(entry_type, entry_id):
    """Get file path for a specific journal entry"""
    journal_folder = os.path.join(data_folder, 'journal')
    if not os.path.exists(journal_folder):
        os.makedirs(journal_folder)
    
    type_folder = os.path.join(journal_folder, entry_type)
    if not os.path.exists(type_folder):
        os.makedirs(type_folder)
    
    return os.path.join(type_folder, f"{entry_id}.txt")

@api_bp.route('/journal/entries', methods=['GET'])
def get_journal_entries():
    """Get all journal entries"""
    try:
        all_entries = []
        journal_folder = os.path.join(data_folder, 'journal')
        
        if not os.path.exists(journal_folder):
            os.makedirs(journal_folder)
            return jsonify([])
            
        for entry_type in os.listdir(journal_folder):
            type_folder = os.path.join(journal_folder, entry_type)
            if os.path.isdir(type_folder):
                for filename in os.listdir(type_folder):
                    if filename.endswith('.txt'):
                        entry_id = filename[:-4]
                        entry_path = os.path.join(type_folder, filename)
                        try:
                            with open(entry_path, 'r', encoding='utf-8') as f:
                                content = f.read()
                                stat = os.stat(entry_path)
                                created = stat.st_ctime
                                updated = stat.st_mtime
                                
                                all_entries.append({
                                    'id': entry_id,
                                    'content': content,
                                    'type': entry_type,
                                    'created': created * 1000,
                                    'updated': updated * 1000
                                })
                        except Exception as e:
                            print(f"Error reading {entry_path}: {e}")
        
        all_entries.sort(key=lambda x: x.get('updated', 0), reverse=True)
        return jsonify(all_entries)
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@api_bp.route('/journal/entry', methods=['POST'])
def save_journal_entry():
    """Save or update a journal entry"""
    try:
        entry_data = request.get_json()
        if not entry_data:
            return jsonify({'status': 'error', 'message': 'No data provided'}), 400
        
        entry_type = entry_data.get('type', 'personal')
        entry_id = entry_data.get('id') or str(int(datetime.now().timestamp() * 1000))
        
        entry_path = get_journal_entry_path(entry_type, entry_id)
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(entry_path), exist_ok=True)
        
        # Save content to text file
        with open(entry_path, 'w', encoding='utf-8') as f:
            f.write(entry_data.get('content', ''))
        
        # Update the file's modification time if this is an update
        if entry_data.get('updated'):
            updated_time = entry_data['updated'] / 1000
            os.utime(entry_path, (updated_time, updated_time))
        
        return jsonify({
            'status': 'success',
            'id': entry_id,
            'message': 'Entry saved successfully',
            'path': entry_path
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500
