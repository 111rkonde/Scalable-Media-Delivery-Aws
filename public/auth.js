class AuthManager {
    constructor() {
        this.isLoginMode = true;
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuth();
    }

    bindEvents() {
        // Form submission
        document.getElementById('authForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAuth();
        });

        // Switch between login and register
        document.getElementById('switchMode').addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleMode();
        });
    }

    toggleMode() {
        this.isLoginMode = !this.isLoginMode;
        
        const registerFields = document.getElementById('registerFields');
        const authBtn = document.getElementById('authBtn');
        const authSubtitle = document.getElementById('authSubtitle');
        const switchText = document.getElementById('switchText');
        const switchMode = document.getElementById('switchMode');
        
        if (this.isLoginMode) {
            // Switch to login mode
            registerFields.style.display = 'none';
            authBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
            authSubtitle.textContent = 'Sign in to your account';
            switchText.textContent = "Don't have an account?";
            switchMode.textContent = 'Sign Up';
        } else {
            // Switch to register mode
            registerFields.style.display = 'block';
            authBtn.innerHTML = '<i class="fas fa-user-plus"></i> Sign Up';
            authSubtitle.textContent = 'Create your account';
            switchText.textContent = "Already have an account?";
            switchMode.textContent = 'Sign In';
        }
        
        this.clearMessages();
    }

    async handleAuth() {
        const authBtn = document.getElementById('authBtn');
        const originalBtnText = authBtn.innerHTML;
        
        // Disable button and show loading
        authBtn.disabled = true;
        authBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        try {
            const formData = new FormData(document.getElementById('authForm'));
            const data = Object.fromEntries(formData.entries());
            
            const endpoint = this.isLoginMode ? '/api/auth/login' : '/api/auth/register';
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                if (this.isLoginMode) {
                    // Login successful
                    localStorage.setItem('token', result.token);
                    localStorage.setItem('user', JSON.stringify(result.user));
                    this.showSuccess('Login successful! Redirecting...');
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 1500);
                } else {
                    // Registration successful
                    this.showSuccess('Registration successful! Please sign in.');
                    this.toggleMode();
                }
            } else {
                this.showError(result.error || 'Authentication failed');
            }
        } catch (error) {
            console.error('Auth error:', error);
            this.showError('Network error. Please try again.');
        } finally {
            // Re-enable button
            authBtn.disabled = false;
            authBtn.innerHTML = originalBtnText;
        }
    }

    async checkAuth() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        
        if (token && user) {
            try {
                // Verify token with server
                const response = await fetch('/api/auth/me', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    // Token is valid, redirect to main app
                    window.location.href = '/';
                    return;
                } else {
                    // Token is invalid, clear storage
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                }
            } catch (error) {
                console.error('Token verification error:', error);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }
        
        // User is not authenticated, show login form
        document.body.style.display = 'block';
    }

    showError(message) {
        const container = document.getElementById('messageContainer');
        container.innerHTML = `<div class="error-message">${message}</div>`;
    }

    showSuccess(message) {
        const container = document.getElementById('messageContainer');
        container.innerHTML = `<div class="success-message">${message}</div>`;
    }

    clearMessages() {
        document.getElementById('messageContainer').innerHTML = '';
    }

    // Logout method (can be called from main app)
    static logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    }

    // Get current user (can be called from main app)
    static getCurrentUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }

    // Get auth token (can be called from main app)
    static getToken() {
        return localStorage.getItem('token');
    }

    // Check if user is authenticated (can be called from main app)
    static isAuthenticated() {
        return !!localStorage.getItem('token');
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});

// Make auth methods available globally
window.AuthManager = AuthManager;
