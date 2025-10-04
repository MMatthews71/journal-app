class MeditationTimer {
    constructor(meditationType, updateCallback, finishCallback) {
        this.meditationType = meditationType;
        this.updateCallback = updateCallback;
        this.finishCallback = finishCallback;
        
        // Define both meditation types
        this.MEDITATION_TYPES = {
            morning: {
                name: "Identity Transformation",
                totalTime: "32 minutes",
                sections: [
                    { 
                        name: "Entering the Present Moment", 
                        duration: 360, // 6 minutes
                        description: "Sit comfortably. Close your eyes. Place hands loosely on legs. Begin with deep breathing.",
                        sound: "low_bell"
                    },
                    { 
                        name: "Recognizing the Old Self", 
                        duration: 240, // 4 minutes
                        description: "Acknowledge old patterns that no longer serve you. Feel the weight of the old self.",
                        sound: "transition_up"
                    },
                    { 
                        name: "Breathing Energy Into Possibility", 
                        duration: 240, // 4 minutes
                        description: "Draw energy up your spine, charging your body with new possibilities.",
                        sound: "energy_rise"
                    },
                    { 
                        name: "Rehearsing the New Self", 
                        duration: 600, // 10 minutes
                        description: "Visualize yourself embodying your chosen qualities. Amplify elevated emotions.",
                        sound: "inspiration"
                    },
                    { 
                        name: "Becoming That Identity", 
                        duration: 300, // 5 minutes
                        description: "Anchor the new self into your body and mind. Merge with your new identity.",
                        sound: "transformation"
                    },
                    { 
                        name: "Closing with Gratitude", 
                        duration: 180, // 3 minutes
                        description: "Lock in the transformation with genuine gratitude. Return to the room.",
                        sound: "completion"
                    }
                ]
            },
            evening: {
                name: "Evening Reflection",
                totalTime: "15 minutes",
                sections: [
                    { 
                        name: "Releasing the Day", 
                        duration: 210, // 3.5 minutes
                        description: "Clear mental/emotional residue from the day. Release tension and worries.",
                        sound: "low_bell"
                    },
                    { 
                        name: "Noticing the Old Self", 
                        duration: 150, // 2.5 minutes
                        description: "Reflect without criticism, just awareness of old habits and reactions.",
                        sound: "transition_up"
                    },
                    { 
                        name: "Reinforcing the New Self", 
                        duration: 210, // 3.5 minutes
                        description: "Strengthen the new identity you're cultivating. Recall successes.",
                        sound: "energy_rise"
                    },
                    { 
                        name: "Becoming Before Sleep", 
                        duration: 150, // 2.5 minutes
                        description: "Program the subconscious mind to hold the new identity overnight.",
                        sound: "inspiration"
                    },
                    { 
                        name: "Closing With Gratitude", 
                        duration: 90, // 1.5 minutes
                        description: "Lock in the state and prepare the body for rest with gratitude.",
                        sound: "completion"
                    }
                ]
            }
        };
        
        this.currentMeditation = this.MEDITATION_TYPES[meditationType];
        this.sections = this.currentMeditation.sections;
        
        this.running = false;
        this.paused = false;
        this.currentSection = 0;
        this.timeLeft = 0;
        this.intervalId = null;
        this.audioContext = null;
    }

    start() {
        if (!this.running) {
            this.running = true;
            this.paused = false;
            this.currentSection = 0;
            this.timeLeft = this.sections[0].duration;
            
            // Play start sound for first section
            this.playSectionSound(this.sections[0].sound);
            
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
                    
                    // Move to the next section
                    this.currentSection++;
                    
                    if (this.currentSection < this.sections.length) {
                        // Play sound for the new section
                        await this.playSectionSound(this.sections[this.currentSection].sound);
                        
                        this.timeLeft = this.sections[this.currentSection].duration;
                        this.updateCallback(this.currentSection, this.timeLeft);
                        
                        // Resume the timer after sound completes
                        setTimeout(() => {
                            this.paused = false;
                            if (!this.intervalId) {
                                this.runTimer();
                            }
                        }, 1000);
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

    async playSectionSound(soundType) {
        return new Promise((resolve) => {
            try {
                if (!this.audioContext) {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }
                
                const now = this.audioContext.currentTime;
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                // Different sounds for different sections
                switch(soundType) {
                    case "low_bell":
                        // Gentle bell to start
                        oscillator.type = 'sine';
                        oscillator.frequency.setValueAtTime(196, now); // G
                        oscillator.frequency.setValueAtTime(392, now + 0.3); // G higher octave
                        gainNode.gain.setValueAtTime(0, now);
                        gainNode.gain.linearRampToValueAtTime(0.3, now + 0.1);
                        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 2);
                        break;
                        
                    case "transition_up":
                        // Rising tone for transition
                        oscillator.type = 'sine';
                        oscillator.frequency.setValueAtTime(220, now); // A
                        oscillator.frequency.linearRampToValueAtTime(440, now + 0.5); // A higher octave
                        gainNode.gain.setValueAtTime(0, now);
                        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.1);
                        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1);
                        break;
                        
                    case "energy_rise":
                        // Energy building sound
                        oscillator.type = 'sawtooth';
                        oscillator.frequency.setValueAtTime(110, now); // A low
                        oscillator.frequency.linearRampToValueAtTime(440, now + 0.8); // A high
                        gainNode.gain.setValueAtTime(0, now);
                        gainNode.gain.linearRampToValueAtTime(0.15, now + 0.2);
                        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
                        break;
                        
                    case "inspiration":
                        // Inspiring chord-like sound
                        oscillator.type = 'sine';
                        oscillator.frequency.setValueAtTime(523.25, now); // C
                        oscillator.frequency.setValueAtTime(659.25, now + 0.2); // E
                        oscillator.frequency.setValueAtTime(783.99, now + 0.4); // G
                        gainNode.gain.setValueAtTime(0, now);
                        gainNode.gain.linearRampToValueAtTime(0.25, now + 0.1);
                        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 2);
                        break;
                        
                    case "transformation":
                        // Transformative, fuller sound
                        oscillator.type = 'triangle';
                        oscillator.frequency.setValueAtTime(329.63, now); // E
                        oscillator.frequency.setValueAtTime(440, now + 0.3); // A
                        oscillator.frequency.setValueAtTime(554.37, now + 0.6); // C# 
                        gainNode.gain.setValueAtTime(0, now);
                        gainNode.gain.linearRampToValueAtTime(0.3, now + 0.2);
                        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 2.5);
                        break;
                        
                    case "completion":
                        // Completion bell sequence
                        oscillator.type = 'sine';
                        oscillator.frequency.setValueAtTime(392, now); // G
                        oscillator.frequency.setValueAtTime(523.25, now + 0.4); // C
                        oscillator.frequency.setValueAtTime(659.25, now + 0.8); // E
                        gainNode.gain.setValueAtTime(0, now);
                        gainNode.gain.linearRampToValueAtTime(0.4, now + 0.1);
                        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 3);
                        break;
                        
                    default:
                        // Default gentle chime
                        oscillator.type = 'sine';
                        oscillator.frequency.setValueAtTime(440, now);
                        oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.5);
                        gainNode.gain.setValueAtTime(0, now);
                        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.1);
                        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1);
                }
                
                oscillator.start(now);
                oscillator.stop(now + (soundType === "completion" ? 3 : 2));
                
                // Resolve when sound is complete
                setTimeout(resolve, (soundType === "completion" ? 3000 : 2000));
            } catch (error) {
                console.log('Audio not supported:', error);
                // If audio fails, still resolve after a delay
                setTimeout(resolve, 1000);
            }
        });
    }

    getCurrentSection() {
        return this.sections[this.currentSection];
    }

    getTotalDuration() {
        return this.sections.reduce((total, section) => total + section.duration, 0);
    }

    getMeditationInfo() {
        return this.currentMeditation;
    }
}

class MeditationApp {
    constructor() {
        this.currentMeditationType = 'morning'; // Default to morning
        this.timer = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadInstructions();
    }

    setupEventListeners() {
        // Meditation type tabs
        document.querySelectorAll('.meditation-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const type = e.target.dataset.type;
                this.switchMeditationType(type);
            });
        });

        // Timer controls
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
    }

    switchMeditationType(type) {
        if (this.currentMeditationType === type) return;
        
        // Stop any running timer
        if (this.timer && this.timer.running) {
            this.stopTimer();
        }
        
        // Update UI
        document.querySelectorAll('.meditation-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-type="${type}"]`).classList.add('active');
        
        this.currentMeditationType = type;
        this.timer = null;
        
        // Update instructions and UI text
        this.loadInstructions();
        
        // Reset timer display
        document.getElementById('time-display').textContent = 'Ready to begin';
        document.getElementById('section-info').textContent = 'Select a meditation and click Start';
        
        // Update titles based on meditation type
        const isMorning = type === 'morning';
        document.getElementById('timer-title').textContent = 
            isMorning ? '⏱️ Morning Meditation Timer' : '⏱️ Evening Meditation Timer';
        document.getElementById('instructions-title').textContent = 
            isMorning ? '📖 Morning Meditation Guide' : '📖 Evening Meditation Guide';
        document.getElementById('reflection-subtitle').textContent = 
            isMorning ? 'Take a moment to reflect on your transformation experience:' : 'Take a moment to reflect on your evening reflection experience:';
        
        this.showNotification(`Switched to ${isMorning ? 'Morning Identity Transformation' : 'Evening Reflection'} meditation`, 'info');
    }

    startTimer() {
        const startBtn = document.getElementById('start-btn');
        const pauseBtn = document.getElementById('pause-btn');
        const stopBtn = document.getElementById('stop-btn');

        startBtn.disabled = true;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;

        if (!this.timer) {
            this.timer = new MeditationTimer(
                this.currentMeditationType,
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
        const currentSection = this.timer.sections[section];
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

        const isMorning = this.currentMeditationType === 'morning';
        
        document.getElementById('time-display').textContent = 
            isMorning ? '🎉 Transformation Complete!' : '🌙 Evening Reflection Complete!';
        document.getElementById('section-info').textContent = 
            isMorning ? 'You have become your new self! Take a moment to reflect.' : 'Rest well and integrate your growth. Take a moment to reflect.';

        // Show reflection section
        document.getElementById('reflection-section').style.display = 'flex';
        document.getElementById('reflection-text').focus();

        this.showNotification(
            isMorning ? 'Transformation meditation completed!' : 'Evening reflection completed!', 
            'success'
        );
    }

    loadInstructions() {
        const instructions = this.currentMeditationType === 'morning' ? 
            this.getMorningInstructions() : 
            this.getEveningInstructions();

        const container = document.getElementById('instructions-content');
        container.innerHTML = ''; // Clear previous instructions
        
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

        // Add integration guidance
        const integration = document.createElement('div');
        integration.style.marginTop = 'var(--spacing-l)';
        integration.style.padding = 'var(--spacing-m)';
        integration.style.background = 'var(--lkm-bg)';
        integration.style.borderRadius = 'var(--border-radius)';
        integration.style.borderLeft = '4px solid var(--lkm-accent)';
        
        if (this.currentMeditationType === 'morning') {
            integration.innerHTML = `
                <h4 style="color: var(--lkm-accent); margin-bottom: var(--spacing-s);">🧭 Integration Guidance</h4>
                <p style="color: var(--text-color); line-height: 1.5; margin-bottom: var(--spacing-s);">
                    <strong>After meditation:</strong> Carry yourself as if you already are that new self. The meditation primes your brain and body, but the real proof comes from your actions throughout the day.
                </p>
                <p style="color: var(--text-color); line-height: 1.5;">
                    <strong>Evening reflection:</strong> Ask, "Where did I live as my new self today? Where did the old self try to creep back in?"
                </p>
            `;
        } else {
            integration.innerHTML = `
                <h4 style="color: var(--lkm-accent); margin-bottom: var(--spacing-s);">🌙 Sleep Integration</h4>
                <p style="color: var(--text-color); line-height: 1.5; margin-bottom: var(--spacing-s);">
                    <strong>During sleep:</strong> Your subconscious mind will continue to integrate the new identity. Trust that your mind is working on your transformation even while you rest.
                </p>
                <p style="color: var(--text-color); line-height: 1.5;">
                    <strong>Tomorrow morning:</strong> Begin your day with the morning identity transformation meditation to reinforce your new self.
                </p>
            `;
        }
        
        container.appendChild(integration);
    }

    getMorningInstructions() {
        return [
            { 
                time: "0:00 – 6:00", 
                title: "Entering the Present Moment", 
                description: "Sit comfortably. Close your eyes. Place hands loosely on legs. Begin with 5 deep breaths: Inhale through nose, hold, exhale slowly through mouth. As you breathe, say silently: 'Inhale: I am... Exhale: Here now.' Bring attention to your body. Feel weight, air, breath rhythm. Imagine awareness withdrawing from past/future, sinking into this moment. Say: 'The past is gone. The future is not here. I am only this present awareness.'" 
            },
            { 
                time: "6:00 – 10:00", 
                title: "Recognizing the Old Self", 
                description: "Bring to mind old patterns that no longer serve you (worry, self-doubt, fear, etc.). See yourself living as that old self — same thoughts, emotions, reactions. Feel how heavy, automatic, and predictable that life is. Say silently: 'That is the old me. That is not who I choose to be anymore.' Imagine gently dissolving that old self into smoke, fading away." 
            },
            { 
                time: "10:00 – 14:00", 
                title: "Breathing Energy Into Possibility", 
                description: "Place attention at the base of your spine. Inhale slowly and imagine drawing energy up along your spine — through chest, throat, into crown of head. Hold for a moment. Exhale and release. Repeat several breaths, visualizing light/energy moving upward, charging your brain and body with new possibility. Feel space opening up — no longer bound to old identity, connected to vast field of possibility." 
            },
            { 
                time: "14:00 – 24:00", 
                title: "Rehearsing the New Self", 
                description: "Ask: 'Who am I choosing to be today?' Choose qualities: confident, calm, joyful, disciplined, loving, free. Visualize yourself embodying those qualities. See specific scenes from your day — meetings, conversations, tasks — living them as your future self. Amplify elevated emotions: Gratitude ('I am thankful this new self exists'), Joy ('It feels so good to be free'), Love ('I deeply love this version of me'). Let your body feel these emotions strongly." 
            },
            { 
                time: "24:00 – 29:00", 
                title: "Becoming That Identity", 
                description: "Silently affirm: 'Today, I am this new self. My thoughts, emotions, and behaviors align with my future. I have already become this version of me.' Picture your old self behind you, fading like a shadow. See your new self in front — glowing, powerful, radiant. Walk toward that self and step into them. Imagine merging completely. Feel it in your body: posture, breath, energy. Say: 'I am this now.'" 
            },
            { 
                time: "29:00 – 32:00", 
                title: "Closing with Gratitude", 
                description: "Place hands on your heart. Breathe deeply and feel genuine gratitude for this transformation. Gratitude signals to your body that the change is already real. Whisper silently: 'Thank you for this new life. Thank you for this new self. Thank you, thank you, thank you.' Slowly return awareness to the room. Wiggle fingers and toes. When ready, open your eyes." 
            }
        ];
    }

    getEveningInstructions() {
        return [
            { 
                time: "0:00 – 3:30", 
                title: "Releasing the Day", 
                description: "Sit or lie down comfortably. Close your eyes. Take a deep breath in, hold, then exhale slowly. With each exhale, imagine letting go of tension, worries, and attachments from the day. Silently repeat: 'The day is complete. I release it now.' Picture the events of the day as clouds drifting across the sky. Let them pass by without judgment." 
            },
            { 
                time: "3:30 – 6:00", 
                title: "Noticing the Old Self", 
                description: "Bring to mind moments when you noticed old habits or reactions: maybe stress, irritation, procrastination, or negative thinking. Say silently: 'That was the old program. I observed it. I don't need to carry it forward.' Imagine those old reactions dissolving like sand slipping through your fingers." 
            },
            { 
                time: "6:00 – 9:30", 
                title: "Reinforcing the New Self", 
                description: "Recall your intention from the morning (the quality you chose: calm, confident, joyful, etc.). See yourself having embodied that quality today — even in small ways. Maybe you paused instead of reacting, smiled more, or shifted into gratitude. Amplify those moments and feel the emotion of success. Say: 'Today I took steps toward becoming my new self. I am proud of this.'" 
            },
            { 
                time: "9:30 – 12:00", 
                title: "Becoming Before Sleep", 
                description: "Visualize your future self — the version of you you're creating — as clearly as possible. How do they stand? How do they speak? What energy radiates from them? Imagine stepping into that version of yourself now. Feel your body merge with theirs. Whisper silently: 'This is who I am now. Tomorrow, I will live more fully as this self.'" 
            },
            { 
                time: "12:00 – 13:30", 
                title: "Closing With Gratitude", 
                description: "Place your hand on your heart. Breathe deeply and feel gratitude for today — even the challenges, because they are proof you're evolving. Whisper silently: 'Thank you for today. Thank you for this transformation. I welcome tomorrow with joy.' Allow your breath to become slower and softer. When ready, let yourself drift naturally into rest." 
            }
        ];
    }

    async saveReflection() {
        const reflectionText = document.getElementById('reflection-text').value.trim();
        
        if (!reflectionText) {
            this.showNotification('Please write something before saving.', 'warning');
            return;
        }

        try {
            // Save reflection to localStorage
            const storageKey = this.currentMeditationType === 'morning' ? 
                'identity_reflections' : 'evening_reflections';
            const reflectionType = this.currentMeditationType === 'morning' ?
                'Identity Transformation Reflection' : 'Evening Reflection';
                
            const reflections = JSON.parse(localStorage.getItem(storageKey) || '[]');
            const reflection = {
                id: Date.now(),
                content: reflectionText,
                timestamp: new Date().toISOString(),
                type: reflectionType
            };
            
            reflections.unshift(reflection);
            localStorage.setItem(storageKey, JSON.stringify(reflections));
            
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
    new MeditationApp();
});