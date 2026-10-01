/* Royal timetable viewer. Reads the existing page theme; does not touch Firebase or PDF logic. */
(() => {
  const TIMETABLE = Object.freeze({
    light: 'https://www.image2url.com/r2/default/images/1790851808988-668582f7-207b-4bf9-9d94-64ca7f2d1fcd.png',
    dark: 'https://www.image2url.com/r2/default/images/1790851961495-55f0d325-d659-415d-9c59-152b0d79b5bb.png'
  });

  function setupTimetable() {
    const overlay = document.getElementById('timetableViewer');
    const image = document.getElementById('timetableImage');
    const directLink = document.getElementById('timetableDirect');
    const themeLabel = document.getElementById('timetableThemeLabel');
    const error = document.getElementById('timetableImageError');
    const close = document.getElementById('timetableClose');
    if (!overlay || !image || !directLink || !close) return;

    let trigger = null;
    function getTheme() {
      return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    }
    function syncImage() {
      const mode = getTheme();
      const url = TIMETABLE[mode];
      themeLabel.textContent = mode === 'light' ? 'LIGHT EDITION' : 'DARK EDITION';
      directLink.href = url;
      if (image.getAttribute('src') !== url) {
        error.hidden = true;
        image.hidden = false;
        image.src = url;
      }
    }
    function openViewer(source) {
      trigger = source || document.activeElement;
      syncImage();
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('locked');
      close.focus();
    }
    function closeViewer() {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('locked');
      trigger?.focus?.();
    }

    document.querySelectorAll('[data-royal-timetable]').forEach(btn => {
      btn.addEventListener('click', event => {
        event.preventDefault();
        const mobileMenu = document.getElementById('mobileMenu');
        if (mobileMenu?.classList.contains('open')) {
          mobileMenu.classList.remove('open');
          mobileMenu.setAttribute('aria-hidden', 'true');
        }
        openViewer(btn);
      });
    });
    close.addEventListener('click', closeViewer);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeViewer();
    });
    document.addEventListener('keydown', event => {
      if (!overlay.classList.contains('open')) return;
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        event.preventDefault();
        closeViewer();
      } else if (event.key === 'Tab') {
        const focusables = [close, directLink].filter(el => !el.hidden);
        if (event.shiftKey && document.activeElement === focusables[0]) {
          event.preventDefault(); focusables[focusables.length - 1].focus();
        } else if (!event.shiftKey && document.activeElement === focusables[focusables.length - 1]) {
          event.preventDefault(); focusables[0].focus();
        }
      }
    }, true);
    image.addEventListener('error', () => {
      image.hidden = true;
      error.hidden = false;
    });
    image.addEventListener('load', () => {
      image.hidden = false;
      error.hidden = true;
    });
    new MutationObserver(() => {
      if (overlay.classList.contains('open')) syncImage();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupTimetable, { once: true });
  } else {
    setupTimetable();
  }
})();