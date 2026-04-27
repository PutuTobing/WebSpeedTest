// Login Page Logic

document.addEventListener('DOMContentLoaded', () => {
    // Redirect if already logged in
    if (isLoggedIn()) {
        window.location.href = 'dashboard.html';
        return;
    }
    
    const loginForm = document.getElementById('login-form');
    const loginMessage = document.getElementById('login-message');
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        // Clear previous message
        loginMessage.textContent = '';
        loginMessage.className = 'message';
        
        // Attempt login
        const result = await login(username, password);
        
        if (result.success) {
            loginMessage.className = 'message success';
            loginMessage.textContent = 'Login berhasil! Mengalihkan...';
            
            // Redirect after short delay
            setTimeout(() => {
                const session = getCurrentSession();
                window.location.href = (session && session.role === 'admin') ? 'admin.html' : 'dashboard.html';
            }, 500);
        } else {
            loginMessage.className = 'message error';
            loginMessage.textContent = result.message;
        }
    });
    
});
// Nav and dropdown initialization is handled by the inline script in login.html.
