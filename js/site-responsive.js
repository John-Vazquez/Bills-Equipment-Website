(function () {
  function setupMobileNavigation() {
    const header = document.querySelector('header');
    if (!header) return;

    const nav = header.querySelector('nav');
    if (!nav || header.querySelector('.mobile-nav-toggle')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mobile-nav-toggle';
    button.setAttribute('aria-label', 'Open navigation');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<span></span>';

    header.insertBefore(button, nav);

    function closeMenu() {
      header.classList.remove('nav-open');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', 'Open navigation');
    }

    button.addEventListener('click', function () {
      const opening = !header.classList.contains('nav-open');
      header.classList.toggle('nav-open', opening);
      button.setAttribute('aria-expanded', opening ? 'true' : 'false');
      button.setAttribute('aria-label', opening ? 'Close navigation' : 'Open navigation');
    });

    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) closeMenu();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMobileNavigation);
  } else {
    setupMobileNavigation();
  }
})();
