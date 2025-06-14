class PopupManager {
    constructor() {
        this.userNameInput = document.getElementById('user-name');
        this.apiKeyInput = document.getElementById('api-key');
        this.objectiveInput = document.getElementById('objective');
        this.toggleBtn = document.getElementById('toggle-key');
        this.saveBtn = document.getElementById('save-config');
        this.statusMessage = document.getElementById('status-message');
        
        this.init();
    }

    async init() {
        await this.loadConfiguration();
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.toggleBtn.addEventListener('click', () => {
            this.togglePasswordVisibility();
        });

        this.saveBtn.addEventListener('click', () => {
            this.saveConfiguration();
        });

        this.userNameInput.addEventListener('input', () => {
            this.clearStatus();
        });

        this.apiKeyInput.addEventListener('input', () => {
            this.clearStatus();
        });

        this.objectiveInput.addEventListener('input', () => {
            this.clearStatus();
        });

        [this.userNameInput, this.apiKeyInput].forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.saveConfiguration();
                }
            });
        });

        // Allow Enter key on objective input to save
        this.objectiveInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveConfiguration();
            }
        });
    }

    async loadConfiguration() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getConfiguration'
            });

            if (response.success) {
                if (response.apiKey) {
                    this.apiKeyInput.value = response.apiKey;
                }
                if (response.userName) {
                    this.userNameInput.value = response.userName;
                }
                if (response.objective) {
                    this.objectiveInput.value = response.objective;
                }
                if (response.apiKey || response.userName || response.objective) {
                    this.showStatus('Configuration loaded successfully', 'success');
                }
            }
        } catch (error) {
            console.error('Error loading configuration:', error);
        }
    }

    togglePasswordVisibility() {
        const isPassword = this.apiKeyInput.type === 'password';
        this.apiKeyInput.type = isPassword ? 'text' : 'password';
        this.toggleBtn.textContent = isPassword ? '🙈' : '👁️';
    }

    async saveConfiguration() {
        const userName = this.userNameInput.value.trim();
        const apiKey = this.apiKeyInput.value.trim();
        const objective = this.objectiveInput.value.trim();
        
        if (!userName) {
            this.showStatus('Please enter your name', 'error');
            return;
        }

        if (!apiKey) {
            this.showStatus('Please enter your OpenAI API key', 'error');
            return;
        }

        if (!objective) {
            this.showStatus('Please enter your networking objective', 'error');
            return;
        }

        if (!this.isValidApiKey(apiKey)) {
            this.showStatus('Invalid API key format. Please check your key.', 'error');
            return;
        }

        this.saveBtn.disabled = true;
        this.saveBtn.textContent = 'Saving...';

        try {
            console.log('Attempting to save configuration...');
            
            const response = await chrome.runtime.sendMessage({
                action: 'setConfiguration',
                userName: userName,
                apiKey: apiKey,
                objective: objective
            });

            console.log('Save response:', response);

            if (response && response.success) {
                this.showStatus('Configuration saved successfully!', 'success');
                setTimeout(() => {
                    this.showStatus('Ready to use! Visit a LinkedIn profile and look for the "🤖 AI Connect" button in the top left', 'info');
                }, 2000);
            } else {
                const errorMessage = response?.error || 'Unknown error occurred';
                console.error('Save failed:', errorMessage);
                this.showStatus(`Failed to save: ${errorMessage}`, 'error');
            }
        } catch (error) {
            console.error('Error saving configuration:', error);
            
            // Provide more specific error messages
            let errorMessage = 'An error occurred while saving. ';
            if (error.message) {
                errorMessage += error.message;
            } else if (error.toString().includes('receiving end does not exist')) {
                errorMessage += 'Extension service worker is not running. Please reload the extension.';
            } else if (error.toString().includes('context invalidated')) {
                errorMessage += 'Extension context was invalidated. Please reload the extension.';
            } else {
                errorMessage += 'Please try again or reload the extension.';
            }
            
            this.showStatus(errorMessage, 'error');
            
            // Fallback: try direct storage API as last resort
            try {
                await chrome.storage.local.set({ 
                    openaiApiKey: apiKey,
                    userName: userName,
                    objective: objective
                });
                this.showStatus('Configuration saved to local storage as fallback!', 'success');
            } catch (fallbackError) {
                console.error('Fallback storage also failed:', fallbackError);
            }
        } finally {
            this.saveBtn.disabled = false;
            this.saveBtn.textContent = 'Save Configuration';
        }
    }

    isValidApiKey(apiKey) {
        // OpenAI API keys typically start with 'sk-' and are around 51 characters long
        return apiKey.startsWith('sk-') && apiKey.length >= 40;
    }

    showStatus(message, type = 'info') {
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message ${type}`;
        this.statusMessage.style.display = 'block';
    }

    clearStatus() {
        this.statusMessage.style.display = 'none';
        this.statusMessage.textContent = '';
        this.statusMessage.className = 'status-message';
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});

// Add some helpful keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        document.getElementById('save-config').click();
    }
    
    // Escape to close popup (if supported by browser)
    if (e.key === 'Escape') {
        window.close();
    }
}); 