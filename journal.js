const { ipcRenderer } = require('electron');

class JournalEntry {
    constructor(content, type = 'personal', timestamp = null) {
        this.id = this.generateId();
        this.content = content;
        this.type = type;
        this.created = timestamp || new Date().toISOString();
        this.updated = new Date().toISOString();
        this.wordCount = this.calculateWordCount(content);
        this.charCount = content.length;
        // Generate formatted content with timestamp at top
        this.formattedContent = this.formatContentWithTimestamp(content);
    }
    
    generateId() {
        return 'entry_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    calculateWordCount(text) {
        return text.trim() ? text.trim().split(/\s+/).length : 0;
    }
    
    formatContentWithTimestamp(content) {
        const date = new Date(this.created);
        const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `--- ${formattedDate} ---\n\n${content}`;
    }
    
    updateContent(newContent) {
        this.content = newContent;
        this.updated = new Date().toISOString();
        this.wordCount = this.calculateWordCount(newContent);
        this.charCount = newContent.length;
        // Update formatted content but keep the same timestamp
        this.formattedContent = this.formatContentWithTimestamp(newContent);
    }
    
    getPreview(maxLength = 100) {
        // Get preview without timestamp
        const plainText = this.content.replace(/[#*`]/g, '').trim();
        return plainText.length > maxLength ? 
            plainText.substring(0, maxLength) + '...' : plainText;
    }
    
    getFormattedDate() {
        const date = new Date(this.created);
        return {
            date: date.toLocaleDateString(),
            time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            full: date.toLocaleString(),
            relative: this.getRelativeTime(date),
            detailed: date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
        };
    }
    
    getRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }
    
    // Get content for saving to file (with timestamp)
    getContentForFile() {
        return this.formattedContent;
    }
    
    // Get content without timestamp (for analysis/search)
    getContentWithoutTimestamp() {
        return this.content;
    }
}

class JournalApp {
    constructor() {
        this.entries = [];
        this.currentEntry = null;
        this.filter = 'all';
        this.searchTerm = '';
        this.deletedEntry = null;
        
        this.init();
    }
    
    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.renderEntries();
            this.updateStats();
            
            if (this.entries.length === 0) {
                this.showNotification('Welcome! Start by creating your first journal entry.', 'info');
            }
        } catch (error) {
            console.error('Error initializing journal:', error);
            this.showNotification('Error initializing journal', 'error');
        }
    }
    
    async loadData() {
        try {
            const result = await ipcRenderer.invoke('get-journal-entries');
            if (result.success) {
                this.entries = result.data.map(data => {
                    const created = typeof data.created === 'number' 
                        ? new Date(data.created).toISOString() 
                        : data.created;
                    const updated = typeof data.updated === 'number' 
                        ? new Date(data.updated).toISOString() 
                        : (data.updated || data.created);
                    
                    // Check if content already has timestamp
                    let contentWithoutTimestamp = data.content;
                    let parsedCreated = created;
                    
                    // Try to extract timestamp from content if it exists
                    const timestampMatch = data.content.match(/^--- (.*) ---\s*\n*/);
                    if (timestampMatch) {
                        try {
                            // Parse the date from the timestamp string
                            const timestampStr = timestampMatch[1];
                            // Remove timestamp line from content
                            contentWithoutTimestamp = data.content.replace(/^---.*---\s*\n*/, '').trim();
                            // Try to parse the date from the timestamp string
                            const parsedDate = new Date(timestampStr);
                            if (!isNaN(parsedDate.getTime())) {
                                parsedCreated = parsedDate.toISOString();
                            }
                        } catch (e) {
                            console.log('Could not parse timestamp from content, using stored created date');
                        }
                    }
                    
                    const entry = new JournalEntry(contentWithoutTimestamp, data.type, parsedCreated);
                    entry.id = data.id;
                    entry.updated = updated;
                    // Recreate formatted content with original timestamp
                    entry.formattedContent = entry.formatContentWithTimestamp(contentWithoutTimestamp);
                    return entry;
                });
                
                this.entries.sort((a, b) => new Date(b.updated) - new Date(a.updated));
                console.log('Journal data loaded successfully');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error loading journal data:', error);
            throw error;
        }
    }
    
    async saveEntryToFile(entry) {
        const entryData = {
            id: entry.id,
            content: entry.getContentForFile(), // Save with timestamp
            type: entry.type,
            created: new Date(entry.created).getTime(),
            updated: new Date(entry.updated).getTime()
        };
        
        const result = await ipcRenderer.invoke('save-journal-entry', entryData);
        return result.success;
    }
    
    async deleteEntryFromFile(entryId, entryType) {
        const result = await ipcRenderer.invoke('delete-journal-entry', entryId, entryType);
        return result.success;
    }
    
    setupEventListeners() {
        document.getElementById('entry-filter').addEventListener('change', (e) => {
            this.filter = e.target.value;
            this.renderEntries();
        });
        
        document.getElementById('entry-search').addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.renderEntries();
        });
        
        document.getElementById('analyze-entry').addEventListener('click', () => {
            this.analyzeCurrentEntry();
        });
        
        document.getElementById('new-entry').addEventListener('click', () => {
            this.newEntry();
        });
        
        document.getElementById('save-entry').addEventListener('click', () => {
            this.saveEntry();
        });
        
        document.getElementById('clear-editor').addEventListener('click', () => {
            this.clearEditor();
        });
        
        document.getElementById('journal-editor').addEventListener('input', (e) => {
            this.updateEditorStats();
            this.updateEditorStatus();
        });
        
        document.querySelector('.close-modal').addEventListener('click', () => {
            this.hideDeleteModal();
        });
        
        document.getElementById('cancel-delete').addEventListener('click', () => {
            this.hideDeleteModal();
        });
        
        document.getElementById('confirm-delete').addEventListener('click', () => {
            this.confirmDelete();
        });
        
        document.getElementById('delete-modal').addEventListener('click', (e) => {
            if (e.target.id === 'delete-modal') {
                this.hideDeleteModal();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveEntry();
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.newEntry();
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key === 'k' && e.shiftKey) {
                e.preventDefault();
                document.getElementById('entry-search').focus();
            }
        });
        
        document.getElementById('notification-action').addEventListener('click', () => {
            this.handleNotificationAction();
        });
        
        // Add focus to editor when clicking on empty space
        document.addEventListener('click', (e) => {
            if (e.target === document.body || e.target.classList.contains('editor-container')) {
                const editor = document.getElementById('journal-editor');
                if (editor) editor.focus();
            }
        });
    }
    
    newEntry() {
        this.currentEntry = null;
        this.clearEditor();
        this.updateEditorStatus();
        document.getElementById('journal-editor').focus();
        this.showNotification('Creating new entry...', 'info', 2000);
    }
    
    async saveEntry() {
        const content = document.getElementById('journal-editor').value.trim();
        const entryType = 'personal';
        
        // Remove existing timestamp line if present (in case user copied it)
        const cleanContent = content.replace(/^---.*---\s*\n*/gm, '').trim();
        
        if (!cleanContent) {
            this.showNotification('Please write something before saving.', 'warning');
            return;
        }
        
        if (this.currentEntry) {
            this.currentEntry.updateContent(cleanContent);
            const success = await this.saveEntryToFile(this.currentEntry);
            if (success) {
                // Update editor with formatted content (with timestamp)
                document.getElementById('journal-editor').value = this.currentEntry.formattedContent;
                this.showNotification('Entry updated successfully!', 'success');
            } else {
                this.showNotification('Error updating entry', 'error');
            }
        } else {
            const newEntry = new JournalEntry(cleanContent, entryType);
            this.entries.unshift(newEntry);
            this.currentEntry = newEntry;
            
            const success = await this.saveEntryToFile(newEntry);
            if (success) {
                // Update editor with formatted content (with timestamp)
                document.getElementById('journal-editor').value = newEntry.formattedContent;
                this.showNotification('New entry saved successfully!', 'success');
            } else {
                this.showNotification('Error saving entry', 'error');
                this.entries.shift();
                this.currentEntry = null;
            }
        }
        
        this.renderEntries();
        this.updateStats();
        this.updateEditorStatus();
    }
    
    loadEntry(entryId) {
        const entry = this.entries.find(e => e.id === entryId);
        if (entry) {
            this.currentEntry = entry;
            // Display the formatted content with timestamp
            document.getElementById('journal-editor').value = entry.formattedContent;
            this.updateEditorStats();
            this.updateEditorStatus();
            document.getElementById('journal-editor').focus();
        }
    }
    
    deleteCurrentEntry() {
        if (!this.currentEntry) {
            this.showNotification('Please select an entry to delete.', 'warning');
            return;
        }
        
        this.showDeleteModal(this.currentEntry);
    }
    
    showDeleteModal(entry) {
        const modal = document.getElementById('delete-modal');
        const preview = document.getElementById('entry-to-delete');
        
        const dateInfo = entry.getFormattedDate();
        preview.textContent = `"${entry.getPreview(50)}" - ${dateInfo.detailed}`;
        
        modal.style.display = 'flex';
    }
    
    hideDeleteModal() {
        document.getElementById('delete-modal').style.display = 'none';
    }
    
    async confirmDelete() {
        if (this.currentEntry) {
            this.deletedEntry = this.currentEntry;
            const success = await this.deleteEntryFromFile(this.currentEntry.id, this.currentEntry.type);
            
            if (success) {
                this.entries = this.entries.filter(e => e.id !== this.currentEntry.id);
                this.currentEntry = null;
                this.renderEntries();
                this.clearEditor();
                this.updateStats();
                this.hideDeleteModal();
                this.showNotification('Entry deleted', 'info', 5000, 'Undo');
            } else {
                this.showNotification('Error deleting entry', 'error');
            }
        }
    }
    
    analyzeCurrentEntry() {
        if (!this.currentEntry) {
            this.showNotification('Please select an entry to analyze.', 'warning');
            return;
        }
        
        window.location.href = `analysis.html?entryId=${this.currentEntry.id}`;
    }
    
    analyzeContent(content) {
        const words = content.trim().split(/\s+/).filter(word => word.length > 0);
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        
        const positiveWords = ['good', 'great', 'happy', 'joy', 'love', 'wonderful', 'amazing', 'excellent', 'positive'];
        const negativeWords = ['bad', 'sad', 'angry', 'hate', 'terrible', 'awful', 'negative', 'difficult', 'hard'];
        
        let positiveCount = 0;
        let negativeCount = 0;
        
        words.forEach(word => {
            const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
            if (positiveWords.includes(cleanWord)) positiveCount++;
            if (negativeWords.includes(cleanWord)) negativeCount++;
        });
        
        const sentiment = positiveCount > negativeCount ? 'positive' : 
                         negativeCount > positiveCount ? 'negative' : 'neutral';
        
        return {
            wordCount: words.length,
            sentenceCount: sentences.length,
            paragraphCount: paragraphs.length,
            avgSentenceLength: words.length / Math.max(sentences.length, 1),
            readingTime: Math.ceil(words.length / 200),
            sentiment: sentiment,
            positiveWords: positiveCount,
            negativeWords: negativeCount
        };
    }
    
    showAnalysis(analysis) {
        const analysisText = `
Word Count: ${analysis.wordCount}
Sentences: ${analysis.sentenceCount}
Paragraphs: ${analysis.paragraphCount}
Reading Time: ${analysis.readingTime} minute(s)
Sentiment: ${analysis.sentiment}
Positive Words: ${analysis.positiveWords}
Negative Words: ${analysis.negativeWords}

Average Sentence Length: ${analysis.avgSentenceLength.toFixed(1)} words
        `.trim();
        
        ipcRenderer.invoke('show-message-box', {
            type: 'info',
            title: 'Entry Analysis',
            message: `Entry Analysis:\n\n${analysisText}`
        });
    }
    
    clearEditor() {
        document.getElementById('journal-editor').value = '';
        this.currentEntry = null;
        this.updateEditorStats();
        this.updateEditorStatus();
    }
    
    renderEntries() {
        const entriesList = document.getElementById('entries-list');
        entriesList.innerHTML = '';
        
        let filteredEntries = this.entries;
        
        if (this.filter !== 'all') {
            filteredEntries = filteredEntries.filter(entry => entry.type === this.filter);
        }
        
        if (this.searchTerm) {
            filteredEntries = filteredEntries.filter(entry => 
                entry.content.toLowerCase().includes(this.searchTerm)
            );
        }
        
        if (filteredEntries.length === 0) {
            entriesList.innerHTML = '<div class="no-entries">No entries found. Create your first journal entry!</div>';
            return;
        }
        
        filteredEntries.forEach(entry => {
            const entryElement = this.createEntryElement(entry);
            entriesList.appendChild(entryElement);
        });
    }
    
    createEntryElement(entry) {
        const entryDiv = document.createElement('div');
        entryDiv.className = `entry-item ${this.currentEntry && this.currentEntry.id === entry.id ? 'selected' : ''}`;
        entryDiv.dataset.id = entry.id;
        
        const dateInfo = entry.getFormattedDate();
        const preview = entry.getPreview(80);
        
        entryDiv.innerHTML = `
            <div class="entry-header">
                <div class="entry-title">${this.getTypeName(entry.type)}</div>
                <span class="entry-type type-${entry.type}">${entry.type}</span>
            </div>
            <div class="entry-date">${dateInfo.detailed}</div>
            <div class="entry-preview">${preview}</div>
        `;
        
        entryDiv.addEventListener('click', () => {
            this.loadEntry(entry.id);
            document.querySelectorAll('.entry-item').forEach(item => {
                item.classList.remove('selected');
            });
            entryDiv.classList.add('selected');
        });
        
        entryDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.currentEntry = entry;
            this.showDeleteModal(entry);
        });
        
        return entryDiv;
    }
    
    getTypeName(type) {
        const names = {
            'personal': 'Personal',
            'manifesto': 'Manifesto',
            'note': 'Note'
        };
        return names[type] || 'Journal Entry';
    }
    
    updateStats() {
        const totalEntries = this.entries.length;
        const totalWords = this.entries.reduce((sum, entry) => sum + entry.wordCount, 0);
        
        document.getElementById('entry-count').textContent = `${totalEntries} ${totalEntries === 1 ? 'entry' : 'entries'}`;
    }
    
    updateEditorStats() {
        const content = document.getElementById('journal-editor').value;
        const cleanContent = content.replace(/^---.*---\s*\n*/gm, '').trim();
        const wordCount = cleanContent ? cleanContent.split(/\s+/).length : 0;
        const charCount = cleanContent.length;
        const readingTime = Math.ceil(wordCount / 200);
        
        document.getElementById('editor-word-count').textContent = wordCount;
        document.getElementById('editor-char-count').textContent = charCount;
        document.getElementById('reading-time').textContent = `${readingTime} min`;
    }
    
    updateEditorStatus() {
        const statusElement = document.getElementById('editor-status');
        
        if (this.currentEntry) {
            const dateInfo = this.currentEntry.getFormattedDate();
            statusElement.textContent = `Editing ${this.getTypeName(this.currentEntry.type)} from ${dateInfo.relative}`;
            statusElement.className = 'status-editing';
        } else {
            const wordCount = document.getElementById('editor-word-count').textContent;
            if (wordCount > 0) {
                statusElement.textContent = `New entry (${wordCount} words)`;
                statusElement.className = 'status-new';
            } else {
                statusElement.textContent = `Ready to create new entry`;
                statusElement.className = '';
            }
        }
    }
    
    showNotification(message, type = 'info', duration = 3000, actionText = null) {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notification-text');
        const notificationAction = document.getElementById('notification-action');
        
        notificationText.textContent = message;
        notification.className = `notification notification-${type}`;
        
        if (actionText) {
            notificationAction.textContent = actionText;
            notificationAction.style.display = 'inline-block';
        } else {
            notificationAction.style.display = 'none';
        }
        
        notification.style.display = 'flex';
        
        if (duration > 0) {
            setTimeout(() => {
                notification.style.display = 'none';
            }, duration);
        }
    }
    
    handleNotificationAction() {
        if (this.deletedEntry) {
            this.entries.unshift(this.deletedEntry);
            this.saveEntryToFile(this.deletedEntry);
            this.renderEntries();
            this.updateStats();
            this.showNotification('Entry restored', 'success');
            this.deletedEntry = null;
        }
        
        document.getElementById('notification').style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new JournalApp();
});