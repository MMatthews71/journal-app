const { ipcRenderer } = require('electron');

class GoalItem {
    constructor(text, level, parentId = null) {
        this.id = this.generateId();
        this.text = text;
        this.level = level;
        this.parentId = parentId;
        this.completed = false;
        this.created = new Date().toISOString();
        this.targetDate = null;
        this.completedAt = null;
        this.children = [];
    }
    
    generateId() {
        return 'goal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

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
        this.activeGoals = [];
        this.completedGoals = [];
        this.activeTodos = [];
        this.completedTodos = [];
        this.lastResetDate = new Date().toISOString().split('T')[0];
        this.dataFolderInfo = '';
        
        this.init();
    }
    
    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.renderGoals();
        this.renderTodos();
        this.updateGoalSelect();
        this.checkDailyReset();
        await this.checkAndHideCompletedGoals();
    }
    
    async loadData() {
        try {
            // Load active goals and tasks
            const [goalsResult, tasksResult] = await Promise.all([
                this.loadDataFromFile('goals', 'active'),
                this.loadDataFromFile('tasks', 'active')
            ]);
            
            if (goalsResult && goalsResult.success) this.activeGoals = goalsResult.data || [];
            if (tasksResult && tasksResult.success) this.activeTodos = tasksResult.data || [];
            
            // Load completed goals and tasks
            const [completedGoalsResult, completedTasksResult] = await Promise.all([
                this.loadDataFromFile('goals', 'completed'),
                this.loadDataFromFile('tasks', 'completed')
            ]);
            
            if (completedGoalsResult && completedGoalsResult.success) this.completedGoals = completedGoalsResult.data || [];
            if (completedTasksResult && completedTasksResult.success) this.completedTodos = completedTasksResult.data || [];
            
            console.log('Data loaded successfully from files');
        } catch (error) {
            console.error('Error loading data:', error);
            this.showNotification('Error loading data from files', 'error');
            // Initialize empty arrays if loading fails
            this.activeGoals = [];
            this.activeTodos = [];
            this.completedGoals = [];
            this.completedTodos = [];
        }
    }
    
    async loadDataFromFile(dataType, status) {
        return await ipcRenderer.invoke('load-data', dataType, status);
    }
    
    async saveGoal(goal, isNew = true) {
        try {
            if (isNew) {
                this.activeGoals.push(goal);
            }
            
            const result = await ipcRenderer.invoke('save-data', 'goals', this.activeGoals, 'active');
            return result.success;
        } catch (error) {
            console.error('Error saving goal:', error);
        }
        return false;
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
    
    async completeGoal(goalId) {
        try {
            const goal = this.activeGoals.find(g => g.id === goalId);
            if (goal) {
                goal.completed = true;
                goal.completedAt = new Date().toISOString();
                this.activeGoals = this.activeGoals.filter(g => g.id !== goalId);
                this.completedGoals.push(goal);
                
                await Promise.all([
                    ipcRenderer.invoke('save-data', 'goals', this.activeGoals, 'active'),
                    ipcRenderer.invoke('save-data', 'goals', this.completedGoals, 'completed')
                ]);
                
                return true;
            }
        } catch (error) {
            console.error('Error completing goal:', error);
        }
        return false;
    }
    
    async reactivateGoal(goalId) {
        try {
            const goal = this.completedGoals.find(g => g.id === goalId);
            if (goal) {
                goal.completed = false;
                goal.completedAt = null;
                this.completedGoals = this.completedGoals.filter(g => g.id !== goalId);
                this.activeGoals.push(goal);
                
                await Promise.all([
                    ipcRenderer.invoke('save-data', 'goals', this.activeGoals, 'active'),
                    ipcRenderer.invoke('save-data', 'goals', this.completedGoals, 'completed')
                ]);
                
                return true;
            }
        } catch (error) {
            console.error('Error reactivating goal:', error);
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
    
    async deleteGoal(goalId) {
        try {
            this.activeGoals = this.activeGoals.filter(g => g.id !== goalId);
            this.completedGoals = this.completedGoals.filter(g => g.id !== goalId);
            
            await Promise.all([
                ipcRenderer.invoke('save-data', 'goals', this.activeGoals, 'active'),
                ipcRenderer.invoke('save-data', 'goals', this.completedGoals, 'completed')
            ]);
            
            return true;
        } catch (error) {
            console.error('Error deleting goal:', error);
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
        // Add goal button
        document.getElementById('add-goal-btn').addEventListener('click', () => {
            this.showGoalModal();
        });
        
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
        
        // Goal modal events
        document.querySelector('.close-modal').addEventListener('click', () => {
            this.hideGoalModal();
        });
        
        document.getElementById('cancel-goal-btn').addEventListener('click', () => {
            this.hideGoalModal();
        });
        
        document.getElementById('save-goal-btn').addEventListener('click', () => {
            this.saveGoalFromModal();
        });
        
        // Goal level change
        document.querySelectorAll('input[name="goal-level"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.updateParentGoalOptions();
            });
        });
        
        // Goal description enter key
        document.getElementById('goal-description').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveGoalFromModal();
            }
        });
        
        // Click outside modal to close
        document.getElementById('goal-modal').addEventListener('click', (e) => {
            if (e.target.id === 'goal-modal') {
                this.hideGoalModal();
            }
        });
        
        // Notification action
        document.getElementById('notification-action').addEventListener('click', () => {
            this.handleNotificationAction();
        });
    }
    
    showGoalModal() {
        document.getElementById('goal-modal').style.display = 'flex';
        document.getElementById('goal-description').focus();
        this.updateParentGoalOptions();
    }
    
    hideGoalModal() {
        document.getElementById('goal-modal').style.display = 'none';
        document.getElementById('goal-description').value = '';
        document.querySelector('input[name="goal-level"][value="monthly"]').checked = true;
        document.getElementById('parent-goal').value = '';
    }
    
    updateParentGoalOptions() {
        const level = document.querySelector('input[name="goal-level"]:checked').value;
        const parentSelect = document.getElementById('parent-goal');
        const parentGroup = document.getElementById('parent-goal-group');
        
        parentSelect.innerHTML = '<option value="">No parent goal</option>';
        
        if (level === 'someday') {
            parentGroup.style.display = 'none';
            return;
        } else {
            parentGroup.style.display = 'block';
        }
        
        let parentLevels = [];
        
        switch(level) {
            case '5year':
                parentLevels = ['someday'];
                break;
            case '1year':
                parentLevels = ['5year'];
                break;
            case 'monthly':
                parentLevels = ['1year'];
                break;
            case 'weekly':
                parentLevels = ['monthly'];
                break;
        }
        
        this.activeGoals
            .filter(goal => parentLevels.includes(goal.level))
            .forEach(goal => {
                const option = document.createElement('option');
                option.value = goal.id;
                option.textContent = goal.text;
                parentSelect.appendChild(option);
            });
    }
    
    async saveGoalFromModal() {
        const description = document.getElementById('goal-description').value.trim();
        const level = document.querySelector('input[name="goal-level"]:checked').value;
        const parentId = document.getElementById('parent-goal').value || null;
        
        if (!description) {
            this.showNotification('Please enter a goal description', 'warning');
            return;
        }
        
        if (level !== 'someday' && !parentId) {
            const result = await ipcRenderer.invoke('show-message-box', {
                type: 'question',
                buttons: ['Continue', 'Cancel'],
                defaultId: 1,
                title: 'No Parent Goal',
                message: 'This goal level typically has a parent. Are you sure you want to continue without a parent?'
            });
            
            if (result.response === 1) return;
        }
        
        const newGoal = new GoalItem(description, level, parentId);
        const success = await this.saveGoal(newGoal, true);
        
        if (success) {
            this.renderGoals();
            this.updateGoalSelect();
            this.hideGoalModal();
            this.showNotification('✓ Goal added successfully!', 'success', 3000);
        } else {
            this.showNotification('Error saving goal', 'error');
        }
    }
    
    async toggleGoalCompletion(goalId) {
        const goal = this.activeGoals.find(g => g.id === goalId) || this.completedGoals.find(g => g.id === goalId);
        if (goal) {
            if (goal.completed) {
                await this.reactivateGoal(goalId);
            } else {
                await this.completeGoal(goalId);
            }
            this.renderGoals();
            this.updateGoalSelect();
        }
    }
    
    async deleteGoalWithConfirmation(goalId) {
        const result = await ipcRenderer.invoke('show-message-box', {
            type: 'question',
            buttons: ['Delete', 'Cancel'],
            defaultId: 1,
            title: 'Delete Goal',
            message: 'Are you sure you want to delete this goal and all its linked tasks?'
        });
        
        if (result.response === 1) return;
        
        const goalsToDelete = [goalId];
        
        const findChildren = (parentId) => {
            [...this.activeGoals, ...this.completedGoals].forEach(goal => {
                if (goal.parentId === parentId) {
                    goalsToDelete.push(goal.id);
                    findChildren(goal.id);
                }
            });
        };
        
        findChildren(goalId);
        
        for (const goalIdToDelete of goalsToDelete) {
            await this.deleteGoal(goalIdToDelete);
            
            const linkedTodos = [...this.activeTodos, ...this.completedTodos].filter(todo => todo.goalId === goalIdToDelete);
            for (const todo of linkedTodos) {
                await this.deleteTodo(todo.id);
            }
        }
        
        this.renderGoals();
        this.renderTodos();
        this.updateGoalSelect();
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
    
    renderGoals() {
        const goalsTree = document.getElementById('goals-tree');
        goalsTree.innerHTML = '';
        
        if (this.activeGoals.length === 0 && this.completedGoals.length === 0) {
            goalsTree.innerHTML = '<p class="no-items">No goals yet. Add your first goal!</p>';
            return;
        }
        
        const activeGoalMap = new Map();
        const activeRootGoals = [];
        
        this.activeGoals.forEach(goal => {
            activeGoalMap.set(goal.id, { ...goal, children: [] });
        });
        
        this.activeGoals.forEach(goal => {
            if (goal.parentId && activeGoalMap.has(goal.parentId)) {
                activeGoalMap.get(goal.parentId).children.push(activeGoalMap.get(goal.id));
            } else {
                activeRootGoals.push(activeGoalMap.get(goal.id));
            }
        });
        
        const levelOrder = { 'someday': 0, '5year': 1, '1year': 2, 'monthly': 3, 'weekly': 4 };
        activeRootGoals.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);
        
        if (activeRootGoals.length > 0) {
            const activeHeader = document.createElement('div');
            activeHeader.className = 'goals-section-header';
            activeHeader.innerHTML = '<h3>Active Goals</h3>';
            goalsTree.appendChild(activeHeader);
            
            activeRootGoals.forEach(goal => {
                goalsTree.appendChild(this.renderGoalNode(goal, 'active'));
            });
        }
        
        if (this.completedGoals.length > 0) {
            const completedHeader = document.createElement('div');
            completedHeader.className = 'goals-section-header completed';
            completedHeader.innerHTML = '<h3>Completed Goals</h3>';
            goalsTree.appendChild(completedHeader);
            
            this.completedGoals.forEach(goal => {
                goalsTree.appendChild(this.renderGoalNode(goal, 'completed'));
            });
        }
    }
    
    renderGoalNode(goal, status) {
        const nodeElement = document.createElement('div');
        nodeElement.className = 'goal-node';
        
        const nodeContent = document.createElement('div');
        nodeContent.className = `goal-node-content ${status}`;
        nodeContent.dataset.id = goal.id;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'goal-checkbox';
        checkbox.checked = status === 'completed';
        checkbox.addEventListener('change', () => {
            this.toggleGoalCompletion(goal.id);
        });
        
        const levelIndicator = document.createElement('span');
        levelIndicator.className = `goal-level-indicator level-${goal.level}`;
        levelIndicator.title = this.getGoalLevelName(goal.level);
        
        const goalText = document.createElement('span');
        goalText.className = `goal-text ${status === 'completed' ? 'goal-completed' : ''}`;
        goalText.textContent = goal.text;
        
        const goalActions = document.createElement('div');
        goalActions.className = 'goal-actions';
        
        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'goal-action';
        deleteBtn.textContent = '🗑️';
        deleteBtn.title = 'Delete goal';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteGoalWithConfirmation(goal.id);
        });
        
        goalActions.appendChild(deleteBtn);
        
        nodeContent.appendChild(checkbox);
        nodeContent.appendChild(levelIndicator);
        nodeContent.appendChild(goalText);
        nodeContent.appendChild(goalActions);
        
        nodeElement.appendChild(nodeContent);
        
        if (status === 'active' && goal.children && goal.children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'goal-children';
            
            goal.children.forEach(child => {
                childrenContainer.appendChild(this.renderGoalNode(child, 'active'));
            });
            
            nodeElement.appendChild(childrenContainer);
        }
        
        return nodeElement;
    }
    
    renderTodos() {
        const tasksList = document.getElementById('tasks-list');
        tasksList.innerHTML = '';
    
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
        
        if (todo.goalId) {
            const goal = [...this.activeGoals, ...this.completedGoals].find(g => g.id === todo.goalId);
            if (goal) {
                const goalLink = document.createElement('span');
                goalLink.className = 'goal-link';
                goalLink.textContent = this.getGoalIcon(goal.level) + ' ' + 
                    (goal.text.length > 20 ? goal.text.substring(0, 20) + '...' : goal.text);
                goalLink.title = `${this.getGoalLevelName(goal.level)}: ${goal.text}`;
                goalLink.addEventListener('click', () => {
                    this.highlightGoal(goal.id);
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
    
    highlightGoal(goalId) {
        document.querySelectorAll('.goal-node-content').forEach(node => {
            node.style.background = '';
        });
        
        const goalNode = document.querySelector(`.goal-node-content[data-id="${goalId}"]`);
        if (goalNode) {
            goalNode.style.background = 'var(--highlight-color)';
            goalNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            setTimeout(() => {
                goalNode.style.background = '';
            }, 3000);
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
    
    getGoalIcon(level) {
        const icons = {
            'someday': '🌟',
            '5year': '📅',
            '1year': '🎯',
            'monthly': '📋',
            'weekly': '📆'
        };
        
        return icons[level] || '🎯';
    }
    
    getGoalLevelName(level) {
        const names = {
            'someday': '🌟 Someday Goal',
            '5year': '📅 5-Year Goal',
            '1year': '🎯 1-Year Goal',
            'monthly': '📋 Monthly Focus',
            'weekly': '📆 Weekly Target'
        };
        
        return names[level] || 'Goal';
    }
    
    updateGoalSelect() {
        const goalSelect = document.getElementById('goal-select');
        goalSelect.innerHTML = '<option value="">None</option>';
        
        this.activeGoals.forEach(goal => {
            const option = document.createElement('option');
            option.value = goal.id;
            option.textContent = goal.text;
            goalSelect.appendChild(option);
        });
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
    
    // Check and hide completed goals at 11:59 PM
    checkAndHideCompletedGoals() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        // If it's 11:59 PM or later, hide completed goals
        if ((currentHour === 23 && currentMinute >= 59) || (currentHour >= 0 && currentHour < 6)) {
            this.hideCompletedGoals();
            return;
        }
        
        // Calculate milliseconds until 11:59 PM
        const targetTime = new Date();
        targetTime.setHours(23, 59, 0, 0);
        
        // If it's already past 11:59 PM, set for tomorrow
        if (now >= targetTime) {
            targetTime.setDate(targetTime.getDate() + 1);
        }
        
        const msUntil1159PM = targetTime - now;
        
        // Set a timeout to hide completed goals at 11:59 PM
        setTimeout(() => this.hideCompletedGoals(), msUntil1159PM);
    }
    
    // Hide completed goals and save changes
    hideCompletedGoals() {
        // Only proceed if there are completed goals to hide
        if (this.completedGoals.length === 0) {
            this.checkAndHideCompletedGoals(); // Check again in case of race conditions
            return;
        }
        
        // Clear completed goals
        this.completedGoals = [];
        
        // Save the updated lists
        ipcRenderer.invoke('save-data', 'goals', this.activeGoals, 'active');
        ipcRenderer.invoke('save-data', 'goals', this.completedGoals, 'completed');
        
        // Re-render the goals list
        this.renderGoals();
        
        // Show notification
        this.showNotification('Completed goals have been cleared for the day', 'info');
        
        // Set a timeout to check again in 1 minute (in case the app is running at 23:59)
        setTimeout(() => this.checkAndHideCompletedGoals(), 60000);
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
            if (this.deletedItem.hasOwnProperty('level')) {
                await this.saveGoal(this.deletedItem, true);
            } else {
                await this.saveTodo(this.deletedItem, true);
            }
            
            this.renderGoals();
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