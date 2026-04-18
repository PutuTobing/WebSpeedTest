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
    
    // Initialize dropdown functionality
    initializeDropdowns();
    
    // Initialize mobile menu
    initializeMobileMenu();
});

// Initialize mobile menu toggle
function initializeMobileMenu() {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            navMenu.classList.toggle('active');
        });
    }
}

// Initialize dropdown menus
function initializeDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown');
    
    dropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector('.dropdown-toggle');
        const menu = dropdown.querySelector('.dropdown-menu');
        
        if (toggle && menu) {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Close other dropdowns
                document.querySelectorAll('.dropdown-menu').forEach(m => {
                    if (m !== menu) {
                        m.classList.remove('show');
                    }
                });
                
                // Toggle current dropdown
                menu.classList.toggle('show');
            });
        }
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.classList.remove('show');
        });
    });
}
