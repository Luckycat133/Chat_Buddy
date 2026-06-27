// Three-state dark mode toggle: light → dark → system → light
// Only include if dark mode is requested.
// Requires: <button id="theme-toggle"> with .sun-icon and .moon-icon child SVGs
(function() {
  const toggle = document.getElementById('theme-toggle');
  const html = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme(theme) {
    html.dataset.theme = theme;
    if (theme === 'system') {
      html.classList.toggle('dark', prefersDark.matches);
    } else {
      html.classList.toggle('dark', theme === 'dark');
    }
    updateIcon();
  }

  function updateIcon() {
    if (!toggle) return;
    const isDark = html.classList.contains('dark');
    const sun = toggle.querySelector('.sun-icon');
    const moon = toggle.querySelector('.moon-icon');
    if (sun) sun.style.display = isDark ? 'block' : 'none';
    if (moon) moon.style.display = isDark ? 'none' : 'block';
  }

  const saved = localStorage.getItem('theme') || 'system';
  applyTheme(saved);

  if (toggle) {
    toggle.addEventListener('click', () => {
      const order = ['light', 'dark', 'system'];
      const current = html.dataset.theme || 'system';
      const next = order[(order.indexOf(current) + 1) % 3];
      localStorage.setItem('theme', next);
      applyTheme(next);
    });
  }

  prefersDark.addEventListener('change', () => {
    if (html.dataset.theme === 'system') {
      html.classList.toggle('dark', prefersDark.matches);
      updateIcon();
    }
  });
})();
