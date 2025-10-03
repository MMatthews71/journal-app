class LKMTimer {
    constructor(updateCallback, finishCallback) {
        this.LKM_SECTIONS = [
            { name: "Settle In", duration: 60, description: "Prepare your space and get comfortable" },
            { name: "Begin with Yourself", duration: 120, description: "May I be happy, may I be healthy, may I be safe, may I live with ease" },
            { name: "Loved One", duration: 120, description: "Picture a close friend or family member" },
            { name: "Neutral Person", duration: 90, description: "Think of someone you see regularly but don't know well" },
            { name: "Difficult Person", duration: 90, description: "Bring to mind someone challenging" },
            { name: "All Beings", duration: 60, description: "Extend your compassion to all living beings" },
            { name: "Closing", duration: 60, description: "Gently return to the present moment" }
        ];
        
        this.running = false;
        this.paused = false;
        this.currentSection = 0;
        this.timeLeft = 0;
        this.updateCallback = updateCallback;
        this.finishCallback = finishCallback;
        this.intervalId = null;
    }

    start() {
        if (!this.running) {
            this.running = true;
            this.paused = false;
            this.currentSection = 0;
            this.timeLeft = this.LKM_SECTIONS[0].duration;
            this.runTimer();
        }
    }

    pauseResume() {
        if (!this.running) return;
        
        this.paused = !this.paused;
        
        if (!this.paused) {
            this.runTimer();
        } else {
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
        }
    }

    stop() {
        this.running = false;
        this.paused = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    async runTimer() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.intervalId = setInterval(async () => {
            if (this.running && !this.paused) {
                if (this.timeLeft > 0) {
                    this.timeLeft--;
                    this.updateCallback(this.currentSection, this.timeLeft);
                } else {
                    // Pause the timer while handling the transition
                    this.paused = true;
                    
                    // Play the transition sound and wait for it to complete
                    await this.playTransitionSound();
                    
                    // Move to the next section
                    this.currentSection++;
                    
                    if (this.currentSection < this.LKM_SECTIONS.length) {
                        this.timeLeft = this.LKM_SECTIONS[this.currentSection].duration;
                        this.updateCallback(this.currentSection, this.timeLeft);
                        // Resume the timer after a brief pause
                        setTimeout(() => {
                            this.paused = false;
                            if (!this.intervalId) {
                                this.runTimer();
                            }
                        }, 500);
                    } else {
                        this.running = false;
                        if (this.intervalId) {
                            clearInterval(this.intervalId);
                            this.intervalId = null;
                        }
                        this.finishCallback();
                    }
                }
            }
        }, 1000);
    }

    playTransitionSound() {
        // Create a simple beep sound using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 1000;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            console.log('Audio not supported:', error);
        }
    }

    getCurrentSection() {
        return this.LKM_SECTIONS[this.currentSection];
    }

    getTotalDuration() {
        return this.LKM_SECTIONS.reduce((total, section) => total + section.duration, 0);
    }
}

class LKMApp {
    constructor() {
        this.timer = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadInstructions();
    }

    setupEventListeners() {
        document.getElementById('start-btn').addEventListener('click', () => {
            this.startTimer();
        });

        document.getElementById('pause-btn').addEventListener('click', () => {
            this.pauseTimer();
        });

        document.getElementById('stop-btn').addEventListener('click', () => {
            this.stopTimer();
        });

        document.getElementById('save-reflection').addEventListener('click', () => {
            this.saveReflection();
        });
        
        document.getElementById('clear-reflection').addEventListener('click', () => {
            this.clearReflection();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Don't interfere with typing in the reflection textarea or any input field
            if (e.target.matches('textarea, input, [contenteditable]')) {
                return;
            }

            if (e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
                if (this.timer && this.timer.running) {
                    this.pauseTimer();
                } else {
                    this.startTimer();
                }
            }
            
            if (e.key === 'Escape') {
                this.stopTimer();
            }
        });

        startBtn.disabled = true;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;

        if (!this.timer) {
            this.timer = new LKMTimer(
                (section, secondsLeft) => this.updateTimerDisplay(section, secondsLeft),
                () => this.onTimerFinish()
            );
        }
        
        this.timer.start();
        pauseBtn.textContent = '⏸ Pause';
    }

    pauseTimer() {
        if (!this.timer) return;

        const pauseBtn = document.getElementById('pause-btn');
        
        this.timer.pauseResume();
        
        if (this.timer.paused) {
            pauseBtn.textContent = '▶ Resume';
            document.getElementById('time-display').textContent = 'Paused';
        } else {
            pauseBtn.textContent = '⏸ Pause';
        }
    }

    stopTimer() {
        if (!this.timer) return;

        const startBtn = document.getElementById('start-btn');
        const pauseBtn = document.getElementById('pause-btn');
        const stopBtn = document.getElementById('stop-btn');

        this.timer.stop();
        
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        pauseBtn.textContent = '⏸ Pause';

        document.getElementById('time-display').textContent = 'Meditation stopped';
        document.getElementById('section-info').textContent = 'Ready to begin again';
    }

    updateTimerDisplay(section, secondsLeft) {
        const currentSection = this.timer.LKM_SECTIONS[section];
        const mins = Math.floor(secondsLeft / 60);
        const secs = secondsLeft % 60;
        
        document.getElementById('time-display').textContent = 
            `${currentSection.name}: ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        document.getElementById('section-info').textContent = currentSection.description;
    }

    onTimerFinish() {
        const startBtn = document.getElementById('start-btn');
        const pauseBtn = document.getElementById('pause-btn');
        const stopBtn = document.getElementById('stop-btn');

        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        startBtn.disabled = false;

        document.getElementById('time-display').textContent = '🎉 Meditation Complete!';
        document.getElementById('section-info').textContent = 'Great job! Take a moment to reflect on your experience.';

        // Show reflection section
        document.getElementById('reflection-section').style.display = 'flex';
        document.getElementById('reflection-text').focus();

        this.showNotification('Meditation completed successfully!', 'success');
    }

    loadInstructions() {
        const instructions = [
            { time: "0:00 – 1:00", title: "Settle In", description: "Sit comfortably, close your eyes or soften your gaze. Take three slow, deep breaths. Let your body relax while your spine stays tall." },
            { time: "1:00 – 3:00", title: "Begin with Yourself", description: "Bring attention to your chest or heart area. Silently repeat: 'May I be safe. May I be healthy. May I live with ease. May I be happy.' Let each phrase sink in." },
            { time: "3:00 – 5:00", title: "Loved One", description: "Bring to mind someone you care about deeply. Picture their face, imagine them smiling. Offer them the same wishes." },
            { time: "5:00 – 6:30", title: "Neutral Person", description: "Think of someone you see often but don't know well. Hold their image in mind and repeat the phrases." },
            { time: "6:30 – 8:00", title: "Difficult Person", description: "Gently bring to mind someone you have tension with. Imagine them as a human being with needs and struggles. Silently offer them the same wishes." },
            { time: "8:00 – 9:00", title: "All Beings", description: "Expand awareness to all beings everywhere. Silently repeat for all living beings." },
            { time: "9:00 – 10:00", title: "Closing", description: "Return attention to your breath. Rest in the feeling of connection. End with: 'May I and all beings live in peace'" }
        ];

        const container = document.getElementById('instructions-content');
        
        instructions.forEach((step, index) => {
            const stepElement = document.createElement('div');
            stepElement.className = 'instruction-step';
            stepElement.innerHTML = `
                <div class="step-header">
                    <span class="step-time">${step.time}</span>
                    <span class="step-title">${step.title}</span>
                </div>
                <div class="step-description">${step.description}</div>
            `;
            container.appendChild(stepElement);
        });

        // Add footer note
        const footer = document.createElement('div');
        footer.style.marginTop = 'var(--spacing-l)';
        footer.style.padding = 'var(--spacing-m)';
        footer.style.background = 'var(--lkm-bg)';
        footer.style.borderRadius = 'var(--border-radius)';
        footer.style.fontSize = '0.9rem';
        footer.style.color = 'var(--text-light)';
        footer.style.textAlign = 'center';
        footer.innerHTML = 'For a 5-minute version, halve the time for each section.';
        container.appendChild(footer);
    }

    async saveReflection() {
        const reflectionText = document.getElementById('reflection-text').value.trim();
        
        if (!reflectionText) {
            this.showNotification('Please write something before saving.', 'warning');
            return;
        }

        try {
            // Save reflection to localStorage as a simple solution
            // In a real app, you would save to a file or database
            const reflections = JSON.parse(localStorage.getItem('lkm_reflections') || '[]');
            const reflection = {
                id: Date.now(),
                content: reflectionText,
                timestamp: new Date().toISOString(),
                type: 'LKM Reflection'
            };
            
            reflections.unshift(reflection);
            localStorage.setItem('lkm_reflections', JSON.stringify(reflections));
            
            this.showNotification('Reflection saved successfully!', 'success');
            this.clearReflection();
            
        } catch (error) {
            console.error('Error saving reflection:', error);
            this.showNotification('Error saving reflection', 'error');
        }
    }

    clearReflection() {
        document.getElementById('reflection-text').value = '';
        document.getElementById('reflection-section').style.display = 'none';
    }

    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notification-text');
        
        notificationText.textContent = message;
        notification.className = `notification notification-${type}`;
        notification.style.display = 'flex';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, duration);
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LKMApp();
});