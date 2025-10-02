const { ipcRenderer } = require('electron');

class TodoItem {
    constructor(text, priority = 'medium', goalId = null, isDaily = false) {
        this.id = this.generateId();
        this.text = text;
        this.goalId = goalId;
        this.completed = false;
        this.created = new Date().toISOString();
        this.priority = priority;
        this.isDaily = isDaily;
        this.lastCompleted = null;
        this.completedAt = null;
    }
    
    generateId() {
        return 'todo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

class TodoApp {
    constructor() {
        this.activeTodos = [];
        this.completedTodos = [];
        this.lastResetDate = new Date().toISOString().split('T')[0];
        this.deletedItem = null;
        this.dataFolderInfo = '';
        this.goalGraph = null;
        
        this.init();
    }
    
    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.renderTodos();
        this.updateGoalSelect();
        this.checkDailyReset();
        
        // Initialize goal graph after a short delay to ensure DOM is ready
        setTimeout(() => {
            this.initializeGoalGraph();
        }, 100);
    }
    
    initializeGoalGraph() {
        // Check if goal graph elements exist
        if (typeof GoalGraph !== 'undefined' && typeof GraphVisualizer !== 'undefined') {
            this.goalGraph = new GoalGraph();
            this.visualizer = new GraphVisualizer('graph', this.goalGraph);
            
            // Override the updateGoalSelect method to use our goal graph
            window.updateGoalSelect = () => this.updateGoalSelect();
            
            console.log('Goal Graph initialized successfully');
        } else {
            console.error('Goal Graph classes not found');
        }
    }
    
    async loadData() {
        try {
            const [tasksResult] = await Promise.all([
                this.loadDataFromFile('tasks', 'active')
            ]);
            
            if (tasksResult.success) this.activeTodos = tasksResult.data;
            
            const [completedTasksResult] = await Promise.all([
                this.loadDataFromFile('tasks', 'completed')
            ]);
            
            if (completedTasksResult.success) this.completedTodos = completedTasksResult.data;
            
            console.log('Todo data loaded successfully from files');
        } catch (error) {
            console.error('Error loading data:', error);
            this.showNotification('Error loading data from files', 'error');
        }
    }
    
    async loadDataFromFile(dataType, status) {
        return await ipcRenderer.invoke('load-data', dataType, status);
    }
    
    async saveTodo(todo, isNew = true) {
        try {
            if (isNew) {
                this.activeTodos.push(todo);
            }
            
            const result = await ipcRenderer.invoke('save-data', 'tasks', this.activeTodos, 'active');
            return result.success;
        } catch (error) {
            console.error('Error saving todo:', error);
        }
        return false;
    }
    
    async completeTodo(todoId) {
        try {
            const todo = this.activeTodos.find(t => t.id === todoId);
            if (todo) {
                todo.completed = true;
                todo.completedAt = new Date().toISOString();
                
                if (todo.isDaily) {
                    todo.lastCompleted = new Date().toISOString().split('T')[0];
                }
                
                this.activeTodos = this.activeTodos.filter(t => t.id !== todoId);
                this.completedTodos.push(todo);
                
                await Promise.all([
                    ipcRenderer.invoke('save-data', 'tasks', this.activeTodos, 'active'),
                    ipcRenderer.invoke('save-data', 'tasks', this.completedTodos, 'completed')
                ]);
                
                return true;
            }
        } catch (error) {
            console.error('Error completing todo:', error);
        }
        return false;
    }
    
    async reactivateTodo(todoId) {
        try {
            const todo = this.completedTodos.find(t => t.id === todoId);
            if (todo) {
                todo.completed = false;
                todo.completedAt = null;
                this.completedTodos = this.completedTodos.filter(t => t.id !== todoId);
                this.activeTodos.push(todo);
                
                await Promise.all([
                    ipcRenderer.invoke('save-data', 'tasks', this.activeTodos, 'active'),
                    ipcRenderer.invoke('save-data', 'tasks', this.completedTodos, 'completed')
                ]);
                
                return true;
            }
        } catch (error) {
            console.error('Error reactivating todo:', error);
        }
        return false;
    }
    
    async deleteTodo(todoId) {
        try {
            const todo = [...this.activeTodos, ...this.completedTodos].find(t => t.id === todoId);
            this.deletedItem = todo;
            
            this.activeTodos = this.activeTodos.filter(t => t.id !== todoId);
            this.completedTodos = this.completedTodos.filter(t => t.id !== todoId);
            
            await Promise.all([
                ipcRenderer.invoke('save-data', 'tasks', this.activeTodos, 'active'),
                ipcRenderer.invoke('save-data', 'tasks', this.completedTodos, 'completed')
            ]);
            
            return true;
        } catch (error) {
            console.error('Error deleting todo:', error);
        }
        return false;
    }
    
    setupEventListeners() {
        // Add task button
        document.getElementById('add-task-btn').addEventListener('click', () => {
            this.addTask();
        });
        
        // Task input enter key
        document.getElementById('task-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addTask();
            }
        });
        
        // Notification action
        document.getElementById('notification-action').addEventListener('click', () => {
            this.handleNotificationAction();
        });
    }
    
    async addTask() {
        const taskInput = document.getElementById('task-input');
        const text = taskInput.value.trim();
        
        if (!text) {
            this.showNotification('Please enter a task description', 'warning');
            return;
        }
        
        const priority = document.querySelector('input[name="priority"]:checked').value;
        const goalId = document.getElementById('goal-select').value || null;
        const isDaily = document.getElementById('daily-task').checked;
        
        const newTodo = new TodoItem(text, priority, goalId, isDaily);
        const success = await this.saveTodo(newTodo, true);
        
        if (success) {
            this.renderTodos();
            this.clearTaskInput();
            this.showNotification('✓ Task added successfully!', 'success');
        } else {
            this.showNotification('Error saving task', 'error');
        }
    }
    
    clearTaskInput() {
        document.getElementById('task-input').value = '';
        document.querySelector('input[name="priority"][value="medium"]').checked = true;
        document.getElementById('goal-select').value = '';
        document.getElementById('daily-task').checked = false;
        document.getElementById('task-input').focus();
    }
    
    async toggleTaskCompletion(todoId) {
        const todo = this.activeTodos.find(t => t.id === todoId) || this.completedTodos.find(t => t.id === todoId);
        if (todo) {
            if (todo.completed) {
                await this.reactivateTodo(todoId);
            } else {
                await this.completeTodo(todoId);
            }
            this.renderTodos();
        }
    }
    
    async deleteTask(todoId) {
        const success = await this.deleteTodo(todoId);
        if (success) {
            this.renderTodos();
            this.showNotification('Task deleted', 'info', 5000, 'Undo');
        }
    }
    
    async editTask(todoId) {
        const todo = [...this.activeTodos, ...this.completedTodos].find(t => t.id === todoId);
        if (!todo) return;
        
        document.getElementById('task-input').value = todo.text;
        document.querySelector(`input[name="priority"][value="${todo.priority}"]`).checked = true;
        document.getElementById('goal-select').value = todo.goalId || '';
        document.getElementById('daily-task').checked = todo.isDaily;
        
        await this.deleteTask(todoId);
        document.getElementById('task-input').focus();
    }
    
    renderTodos() {
        const tasksList = document.getElementById('tasks-list');
        tasksList.innerHTML = '';
    
        // Remove any existing grid class and add it back
        tasksList.classList.remove('tasks-grid');
        tasksList.classList.add('tasks-grid');
        
        if (this.activeTodos.length === 0 && this.completedTodos.length === 0) {
            tasksList.innerHTML = '<p class="no-items">No tasks for today. Add your first task!</p>';
            return;
        }
        
        const oneThingTasks = this.activeTodos.filter(todo => todo.priority === 'one_thing');
        const otherActiveTasks = this.activeTodos.filter(todo => todo.priority !== 'one_thing');
        
        const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
        otherActiveTasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || a.text.localeCompare(b.text));
        
        const sortedCompletedTodos = [...this.completedTodos].sort((a, b) => 
            new Date(b.completedAt) - new Date(a.completedAt)
        );
        
        if (oneThingTasks.length > 0) {
            const oneThingHeader = document.createElement('div');
            oneThingHeader.className = 'tasks-section-header';
            oneThingHeader.innerHTML = '<h3>ONE Thing Tasks</h3>';
            tasksList.appendChild(oneThingHeader);
            
            oneThingTasks.forEach(todo => {
                tasksList.appendChild(this.createTaskElement(todo, 'active'));
            });
        }
        
        if (otherActiveTasks.length > 0) {
            const activeHeader = document.createElement('div');
            activeHeader.className = 'tasks-section-header';
            activeHeader.innerHTML = '<h3>Active Tasks</h3>';
            tasksList.appendChild(activeHeader);
            
            otherActiveTasks.forEach(todo => {
                tasksList.appendChild(this.createTaskElement(todo, 'active'));
            });
        }
        
        if (sortedCompletedTodos.length > 0) {
            const completedHeader = document.createElement('div');
            completedHeader.className = 'tasks-section-header completed';
            completedHeader.innerHTML = '<h3>Completed Tasks</h3>';
            tasksList.appendChild(completedHeader);
            
            sortedCompletedTodos.forEach(todo => {
                tasksList.appendChild(this.createTaskElement(todo, 'completed'));
            });
        }
    }
    
    createTaskElement(todo, status) {
        const taskItem = document.createElement('div');
        taskItem.className = `task-item ${todo.priority}-priority ${status}`;
        taskItem.dataset.id = todo.id;
        
        const taskHeader = document.createElement('div');
        taskHeader.className = 'task-header';
        
        const prioritySpan = document.createElement('span');
        prioritySpan.className = 'task-priority';
        prioritySpan.textContent = this.getPriorityIcon(todo.priority);
        prioritySpan.title = this.getPriorityTooltip(todo.priority);
        
        const taskContent = document.createElement('div');
        taskContent.className = 'task-content';
        
        const taskText = document.createElement('div');
        taskText.className = `task-text ${status === 'completed' ? 'task-completed' : ''}`;
        taskText.textContent = todo.text;
        taskText.addEventListener('click', () => {
            this.toggleTaskCompletion(todo.id);
        });
        
        const taskActions = document.createElement('div');
        taskActions.className = 'task-actions';
        
        if (status === 'active') {
            const editAction = document.createElement('button');
            editAction.className = 'task-action';
            editAction.textContent = 'Edit';
            editAction.title = 'Edit task';
            editAction.addEventListener('click', () => {
                this.editTask(todo.id);
            });
            taskActions.appendChild(editAction);
        }
        
        const deleteAction = document.createElement('button');
        deleteAction.className = 'task-action';
        deleteAction.textContent = 'Delete';
        deleteAction.title = 'Delete task';
        deleteAction.addEventListener('click', () => {
            this.deleteTask(todo.id);
        });
        
        taskActions.appendChild(deleteAction);
        
        taskContent.appendChild(taskText);
        taskContent.appendChild(taskActions);
        
        taskHeader.appendChild(prioritySpan);
        taskHeader.appendChild(taskContent);
        
        const taskMeta = document.createElement('div');
        taskMeta.className = 'task-meta';
        
        if (todo.goalId && this.goalGraph) {
            const goal = this.goalGraph.getNode(todo.goalId);
            if (goal) {
                const goalLink = document.createElement('span');
                goalLink.className = 'goal-link';
                goalLink.textContent = this.getGoalIcon(goal.category) + ' ' + 
                    (goal.id.length > 20 ? goal.id.substring(0, 20) + '...' : goal.id);
                goalLink.title = `${this.getGoalCategoryName(goal.category)}: ${goal.id}`;
                goalLink.addEventListener('click', () => {
                    this.highlightGoalInGraph(goal.id);
                });
                
                taskMeta.appendChild(goalLink);
            }
        }
        
        if (todo.isDaily) {
            const dailyIndicator = document.createElement('span');
            dailyIndicator.className = 'daily-indicator';
            
            let dailyIcon = '🔄';
            let dailyTooltip = 'Recurring daily task';
            
            if (status === 'completed' && todo.lastCompleted) {
                dailyIcon = '✅';
                dailyTooltip = 'Completed today';
            }
            
            dailyIndicator.textContent = `${dailyIcon} Daily`;
            dailyIndicator.title = dailyTooltip;
            
            taskMeta.appendChild(dailyIndicator);
        }
        
        if (status === 'completed' && todo.completedAt) {
            const completionDate = document.createElement('span');
            completionDate.className = 'completion-date';
            const date = new Date(todo.completedAt);
            completionDate.textContent = `Completed: ${date.toLocaleDateString()}`;
            completionDate.title = `Completed on ${date.toLocaleString()}`;
            taskMeta.appendChild(completionDate);
        }
        
        taskItem.appendChild(taskHeader);
        taskItem.appendChild(taskMeta);
        
        return taskItem;
    }
    
    highlightGoalInGraph(goalId) {
        if (this.visualizer) {
            // Show the sidebar if it's collapsed
            document.getElementById('sidebar').classList.remove('collapsed');
            
            // Select and show the goal info
            const goal = this.goalGraph.getNode(goalId);
            if (goal) {
                this.visualizer.showNodeInfo(goal);
                this.visualizer.highlightConnections(goalId);
                
                // Center the view on the goal
                this.visualizer.centerNode(goal);
            }
        }
    }
    
    updateGoalSelect() {
        const goalSelect = document.getElementById('goal-select');
        goalSelect.innerHTML = '<option value="">None</option>';
        
        if (this.goalGraph) {
            this.goalGraph.getAllNodes().forEach(goal => {
                const option = document.createElement('option');
                option.value = goal.id;
                option.textContent = goal.id;
                goalSelect.appendChild(option);
            });
        }
    }
    
    getPriorityIcon(priority) {
        const icons = {
            'one_thing': '⭐',
            'high': '🔥',
            'medium': '📅',
            'low': '📌'
        };
        
        return icons[priority] || '📌';
    }
    
    getPriorityTooltip(priority) {
        const tooltips = {
            'one_thing': '⭐ The ONE Thing (Most Important Task)',
            'high': '🔥 High Priority (Do Today)',
            'medium': '📅 Medium Priority (This Week)',
            'low': '📌 Low Priority (Backlog)'
        };
        
        return tooltips[priority] || 'Priority';
    }
    
    getGoalIcon(category) {
        const icons = {
            'personal': '🌟',
            'work': '💼',
            'learning': '📚',
            'health': '❤️',
            'financial': '💰'
        };
        
        return icons[category] || '🎯';
    }
    
    getGoalCategoryName(category) {
        const names = {
            'personal': 'Personal',
            'work': 'Career',
            'learning': 'Learning',
            'health': 'Health',
            'financial': 'Financial'
        };
        
        return names[category] || 'Goal';
    }
    
    checkDailyReset() {
        const today = new Date().toISOString().split('T')[0];
        
        if (this.lastResetDate !== today) {
            let resetCount = 0;
            
            this.completedTodos.forEach(todo => {
                if (todo.isDaily && todo.lastCompleted && todo.lastCompleted !== today) {
                    this.reactivateTodo(todo.id);
                    resetCount++;
                }
            });
            
            if (resetCount > 0) {
                this.lastResetDate = today;
                this.renderTodos();
                
                this.showNotification(`${resetCount} daily task(s) reset for today`, 'info');
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
    
    async handleNotificationAction() {
        if (this.deletedItem) {
            await this.saveTodo(this.deletedItem, true);
            
            this.renderTodos();
            this.updateGoalSelect();
            
            this.showNotification('Item restored', 'success');
            this.deletedItem = null;
        }
        
        document.getElementById('notification').style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TodoApp();
});