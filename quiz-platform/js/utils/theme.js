// theme.js - Shared dark/light theme toggle handler
// Load this script on every page to enable theme switching

document.addEventListener('DOMContentLoaded', function () {
    var themeToggleBtn = document.getElementById('theme-toggle');
    var htmlEl = document.documentElement;

    // Restore saved theme preference (default: dark)
    var savedTheme = localStorage.getItem('theme') || 'dark';
    htmlEl.setAttribute('data-theme', savedTheme);
    if (themeToggleBtn) themeToggleBtn.checked = savedTheme === 'dark';

    // Listen for toggle changes
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('change', function (e) {
            var newTheme = e.target.checked ? 'dark' : 'light';
            htmlEl.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }
});
