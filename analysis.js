const { ipcRenderer } = require('electron');

class AnalysisApp {
    constructor() {
        this.entries = [];
        this.currentEntry = null;
        this.analysisData = {
            facts: '',
            judgment: '',
            intent: '',
            action: '',
            outcome: '',
            gap: '',
            globalLabel: '',
            skillDeficit: '',
            plan: '',
            conclusion: ''
        };
        
        this.init();
    }
    
    async init() {
        try {
            await this.loadEntries();
            this.setupEventListeners();
            this.renderEntries();
            
            // Check if we have a specific entry ID from URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            const entryId = urlParams.get('entryId');
            if (entryId) {
                this.selectEntryById(entryId);
            }
            
            if (this.entries.length === 0) {
                this.showNotification('No journal entries found. Create some entries first.', 'info');
            }
        } catch (error) {
            console.error('Error initializing analysis app:', error);
            this.showNotification('Error initializing analysis', 'error');
        }
    }
    
    async loadEntries() {
        try {
            const result = await ipcRenderer.invoke('get-journal-entries');
            if (result.success) {
                // Filter only personal entries for analysis
                this.entries = result.data.filter(entry => entry.type === 'personal');
                this.entries.sort((a, b) => new Date(b.updated) - new Date(a.updated));
                console.log('Journal entries loaded successfully for analysis');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error loading journal entries:', error);
            throw error;
        }
    }
    
    setupEventListeners() {
        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.refreshEntries();
        });
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // Text area changes
        document.getElementById('facts-text').addEventListener('input', (e) => {
            this.analysisData.facts = e.target.value;
        });
        
        document.getElementById('judgment-text').addEventListener('input', (e) => {
            this.analysisData.judgment = e.target.value;
        });
        
        document.getElementById('intent-text').addEventListener('input', (e) => {
            this.analysisData.intent = e.target.value;
        });
        
        document.getElementById('action-text').addEventListener('input', (e) => {
            this.analysisData.action = e.target.value;
        });
        
        document.getElementById('outcome-text').addEventListener('input', (e) => {
            this.analysisData.outcome = e.target.value;
        });
        
        document.getElementById('gap-text').addEventListener('input', (e) => {
            this.analysisData.gap = e.target.value;
        });
        
        document.getElementById('global-label-text').addEventListener('input', (e) => {
            this.analysisData.globalLabel = e.target.value;
        });
        
        document.getElementById('skill-deficit-text').addEventListener('input', (e) => {
            this.analysisData.skillDeficit = e.target.value;
        });
        
        document.getElementById('plan-text').addEventListener('input', (e) => {
            this.analysisData.plan = e.target.value;
        });
        
        document.getElementById('conclusion-text').addEventListener('input', (e) => {
            this.analysisData.conclusion = e.target.value;
        });
        
        // Action buttons
        document.getElementById('clear-btn').addEventListener('click', () => {
            this.clearAnalysis();
        });
        
        document.getElementById('copy-btn').addEventListener('click', () => {
            this.copyAnalysis();
        });
        
        document.getElementById('save-btn').addEventListener('click', () => {
            this.saveAnalysis();
        });
        
        // Notification action
        document.getElementById('notification-action').addEventListener('click', () => {
            this.handleNotificationAction();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveAnalysis();
            }
        });
    }
    
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Focus the first textarea in the active tab
        const firstTextarea = document.querySelector(`#${tabName}-tab textarea`);
        if (firstTextarea) {
            firstTextarea.focus();
        }
    }
    
    renderEntries() {
        const entriesList = document.getElementById('entries-list');
        const entryCount = document.getElementById('entry-count');
        
        entriesList.innerHTML = '';
        
        if (this.entries.length === 0) {
            entriesList.innerHTML = '<div class="no-entries">No personal journal entries found</div>';
            entryCount.textContent = 'No entries';
            return;
        }
        
        this.entries.forEach(entry => {
            const entryElement = this.createEntryElement(entry);
            entriesList.appendChild(entryElement);
        });
        
        entryCount.textContent = `${this.entries.length} ${this.entries.length === 1 ? 'entry' : 'entries'}`;
    }
    
    createEntryElement(entry) {
        const entryDiv = document.createElement('div');
        entryDiv.className = `entry-item ${this.currentEntry && this.currentEntry.id === entry.id ? 'selected' : ''}`;
        entryDiv.dataset.id = entry.id;
        
        const date = new Date(entry.created);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        entryDiv.innerHTML = `
            <div class="entry-title">${this.getEntryTitle(entry.content)}</div>
            <div class="entry-date">${dateStr} at ${timeStr}</div>
        `;
        
        entryDiv.addEventListener('click', () => {
            this.selectEntry(entry);
        });
        
        return entryDiv;
    }
    
    getEntryTitle(content) {
        // Extract first line or first 50 characters as title
        const firstLine = content.split('\n')[0].trim();
        if (firstLine.length > 50) {
            return firstLine.substring(0, 50) + '...';
        }
        return firstLine || 'Untitled Entry';
    }
    
    selectEntry(entry) {
        // Update UI
        document.querySelectorAll('.entry-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelector(`.entry-item[data-id="${entry.id}"]`).classList.add('selected');
        
        // Set current entry
        this.currentEntry = entry;
        
        // Update full content display
        this.updateFullContent(entry);
        
        // Update analysis status
        this.updateAnalysisStatus(entry);
        
        // Enable analysis
        this.setAnalysisEnabled(true);
        
        // Auto-scroll to top of analysis panel
        document.querySelector('.analysis-container').scrollTop = 0;
    }
    
    selectEntryById(entryId) {
        const entry = this.entries.find(e => e.id === entryId);
        if (entry) {
            this.selectEntry(entry);
        }
    }
    
    updateFullContent(entry) {
        const contentElement = document.getElementById('full-entry-content');
        const metaElement = document.getElementById('entry-meta');
        
        const date = new Date(entry.created);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Update metadata
        metaElement.textContent = `Created on ${dateStr} at ${timeStr}`;
        
        // Format and display the full content
        const formattedContent = this.formatJournalContent(entry.content);
        contentElement.innerHTML = formattedContent;
    }
    
    formatJournalContent(content) {
        // Simple formatting for journal content
        // Replace line breaks with paragraphs and preserve multiple line breaks
        const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        
        if (paragraphs.length === 0) {
            return '<p class="empty-content">No content in this entry.</p>';
        }
        
        return paragraphs.map(paragraph => {
            // Handle single line breaks within paragraphs
            const lines = paragraph.split('\n').filter(line => line.trim().length > 0);
            if (lines.length === 1) {
                return `<p>${this.escapeHtml(lines[0])}</p>`;
            } else {
                return `<p>${lines.map(line => this.escapeHtml(line)).join('<br>')}</p>`;
            }
        }).join('');
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    updateAnalysisStatus(entry) {
        const statusElement = document.getElementById('analysis-status');
        const date = new Date(entry.created);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        statusElement.textContent = `Analyzing entry from ${dateStr} at ${timeStr}`;
        statusElement.style.color = 'var(--analysis-accent)';
        statusElement.style.fontWeight = '500';
    }
    
    setAnalysisEnabled(enabled) {
        const textareas = document.querySelectorAll('textarea');
        const tabButtons = document.querySelectorAll('.tab-btn');
        
        textareas.forEach(textarea => {
            textarea.disabled = !enabled;
            if (enabled) {
                textarea.style.opacity = '1';
                textarea.style.cursor = 'text';
            } else {
                textarea.style.opacity = '0.6';
                textarea.style.cursor = 'not-allowed';
            }
        });
        
        // Update tab buttons to reflect enabled state
        tabButtons.forEach(btn => {
            if (!enabled && !btn.classList.contains('active')) {
                btn.style.opacity = '0.5';
                btn.style.pointerEvents = 'none';
            } else {
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            }
        });
        
        // Update action buttons
        const actionButtons = document.querySelectorAll('.action-buttons button');
        actionButtons.forEach(btn => {
            if (btn.id !== 'refresh-btn') {
                btn.disabled = !enabled;
            }
        });
    }
    
    async refreshEntries() {
        try {
            await this.loadEntries();
            this.renderEntries();
            
            // If we had a current entry selected, try to reselect it
            if (this.currentEntry) {
                const refreshedEntry = this.entries.find(e => e.id === this.currentEntry.id);
                if (refreshedEntry) {
                    this.selectEntry(refreshedEntry);
                } else {
                    // Entry was deleted, clear the analysis
                    this.currentEntry = null;
                    this.clearContentDisplay();
                    this.setAnalysisEnabled(false);
                }
            }
            
            this.showNotification('Entries refreshed', 'success');
        } catch (error) {
            console.error('Error refreshing entries:', error);
            this.showNotification('Error refreshing entries', 'error');
        }
    }
    
    clearContentDisplay() {
        const contentElement = document.getElementById('full-entry-content');
        const metaElement = document.getElementById('entry-meta');
        const statusElement = document.getElementById('analysis-status');
        
        contentElement.innerHTML = `
            <div class="no-entry-selected">
                <div class="placeholder-icon">📝</div>
                <p>Select a journal entry from the list above to begin your analysis.</p>
                <p class="placeholder-sub">The full content will appear here for easy reference while you analyze.</p>
            </div>
        `;
        
        metaElement.textContent = 'Select an entry to view content';
        statusElement.textContent = 'Select an entry to begin analysis';
        statusElement.style.color = 'var(--text-light)';
        statusElement.style.fontWeight = 'normal';
    }
    
    clearAnalysis() {
        if (!this.currentEntry) {
            this.showNotification('Please select an entry first', 'warning');
            return;
        }
        
        if (confirm('This will clear all your analysis work. Are you sure?')) {
            // Clear all text areas
            document.getElementById('facts-text').value = '';
            document.getElementById('judgment-text').value = '';
            document.getElementById('intent-text').value = '';
            document.getElementById('action-text').value = '';
            document.getElementById('outcome-text').value = '';
            document.getElementById('gap-text').value = '';
            document.getElementById('global-label-text').value = '';
            document.getElementById('skill-deficit-text').value = '';
            document.getElementById('plan-text').value = '';
            document.getElementById('conclusion-text').value = '';
            
            // Reset analysis data
            this.analysisData = {
                facts: '',
                judgment: '',
                intent: '',
                action: '',
                outcome: '',
                gap: '',
                globalLabel: '',
                skillDeficit: '',
                plan: '',
                conclusion: ''
            };
            
            // Go to first tab
            this.switchTab('facts');
            
            this.showNotification('Analysis cleared', 'info');
        }
    }
    
    copyAnalysis() {
        if (!this.currentEntry) {
            this.showNotification('Please select an entry first', 'warning');
            return;
        }
        
        const analysisText = this.formatAnalysisForExport();
        
        if (!analysisText || analysisText.trim() === '') {
            this.showNotification('No analysis content to copy', 'info');
            return;
        }
        
        // Copy to clipboard
        navigator.clipboard.writeText(analysisText).then(() => {
            this.showNotification('Analysis copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy analysis: ', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = analysisText;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                this.showNotification('Analysis copied to clipboard!', 'success');
            } catch (fallbackErr) {
                this.showNotification('Failed to copy analysis', 'error');
            }
            document.body.removeChild(textArea);
        });
    }
    
    async saveAnalysis() {
        if (!this.currentEntry) {
            this.showNotification('Please select an entry first', 'warning');
            return;
        }
        
        // Check if there's any content to save
        const hasContent = Object.values(this.analysisData).some(value => value.trim() !== '');
        
        if (!hasContent) {
            this.showNotification('Please complete some analysis before saving', 'info');
            return;
        }
        
        try {
            // Prepare analysis data
            const analysisToSave = {
                ...this.analysisData,
                originalEntryId: this.currentEntry.id,
                originalEntryContent: this.currentEntry.content,
                analysisDate: new Date().toISOString()
            };
            
            // Save analysis
            const result = await ipcRenderer.invoke('save-analysis', analysisToSave);
            
            if (result.success) {
                this.showNotification('Analysis saved successfully!', 'success');
                
                // Ask if user wants to clear (but don't auto-clear)
                setTimeout(() => {
                    if (confirm('Would you like to clear the current analysis and start fresh?')) {
                        this.clearAnalysis();
                    }
                }, 1000);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error saving analysis:', error);
            this.showNotification('Error saving analysis', 'error');
        }
    }
    
    formatAnalysisForExport() {
        let output = "=== CRITICAL SELF-ANALYSIS ===\n\n";
        
        if (this.currentEntry) {
            const date = new Date(this.currentEntry.created);
            output += `Original Entry: ${date.toLocaleString()}\n`;
            output += `Analysis Date: ${new Date().toLocaleString()}\n\n`;
        }
        
        // Step 1: Facts
        if (this.analysisData.facts.trim()) {
            output += "1. 📋 FACTS (Raw Data)\n" + "=".repeat(50) + "\n";
            output += this.analysisData.facts + "\n\n";
        }
        
        // Step 2: Self-Judgment  
        if (this.analysisData.judgment.trim()) {
            output += "2. 🔍 SELF-JUDGMENT (Internal Critic)\n" + "=".repeat(50) + "\n";
            output += this.analysisData.judgment + "\n\n";
        }
        
        // Step 3: Deconstruction
        if (this.analysisData.intent.trim() || this.analysisData.action.trim() || 
            this.analysisData.outcome.trim() || this.analysisData.gap.trim()) {
            output += "3. 🔧 DECONSTRUCTION\n" + "=".repeat(50) + "\n";
            output += `🎯 Intent: ${this.analysisData.intent}\n\n`;
            output += `⚡ Action: ${this.analysisData.action}\n\n`;
            output += `📊 Outcome: ${this.analysisData.outcome}\n\n`;
            output += `🔍 The Gap: ${this.analysisData.gap}\n\n`;
        }
        
        // Step 4: Reframe
        if (this.analysisData.globalLabel.trim() || this.analysisData.skillDeficit.trim()) {
            output += "4. 🔄 REFRAME\n" + "=".repeat(50) + "\n";
            output += `❌ Global Label: ${this.analysisData.globalLabel}\n\n`;
            output += `✅ Specific Skill Deficit: ${this.analysisData.skillDeficit}\n\n`;
        }
        
        // Step 5: Plan
        if (this.analysisData.plan.trim()) {
            output += "5. 🎯 PRACTICAL PLAN\n" + "=".repeat(50) + "\n";
            output += this.analysisData.plan + "\n\n";
        }
        
        // Step 6: Conclusion
        if (this.analysisData.conclusion.trim()) {
            output += "6. 💡 UNFORGIVING CONCLUSION\n" + "=".repeat(50) + "\n";
            output += this.analysisData.conclusion + "\n";
        }
        
        return output;
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
        // Handle undo action if needed
        document.getElementById('notification').style.display = 'none';
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AnalysisApp();
});