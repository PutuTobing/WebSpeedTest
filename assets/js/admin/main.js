// Admin Panel Logic

let currentApprovalFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    // Require admin access
    if (!requireAdmin()) return;
    
    // Initialize components
    initializeTabs();
    initializeMobileMenu();
    loadUsers();
    loadApprovalServers();
    loadAllServers();
    loadEndpoints();

    // Initialize modals
    initializeUserModal();
    initializePasswordModal();
    initializeEditServerModal();
    initializeEndpointModal();
    initApprovalFilters();
    initPingAllButton();
    initClock();
    startAutoCheck();
    initSiteSettings();
    initBackupRestore();

    // Close modal when clicking outside (on backdrop)
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    });
});

// Initialize tabs
