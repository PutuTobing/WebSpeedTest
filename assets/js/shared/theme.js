// Theme toggle — runs on all pages
(function () {
    // Apply saved theme immediately (backup for inline script)
    const saved = localStorage.getItem('speedtest_theme');
    if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');

    function isLight() {
        return document.documentElement.getAttribute('data-theme') === 'light';
    }

    document.addEventListener('DOMContentLoaded', function () {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;

        // Set initial icon
        btn.textContent = isLight() ? '☀️' : '🌙';

        btn.addEventListener('click', function () {
            const light = isLight();
            const newTheme = light ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('speedtest_theme', newTheme);
            btn.textContent = light ? '🌙' : '☀️';
        });
    });
})();
