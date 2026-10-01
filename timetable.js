/* Theme-aware timetable feature. No changes to the original 8aPDF theme or app logic. */
(() => {
  const images = Object.freeze({
    light:'https://www.image2url.com/r2/default/images/1790851808988-668582f7-207b-4bf9-9d94-64ca7f2d1fcd.png',
    dark:'https://www.image2url.com/r2/default/images/1790851961495-55f0d325-d659-415d-9c59-152b0d79b5bb.png'
  });

  function setupTimetable() {
    const dialog = document.getElementById('timetableOverlay');
    const img = document.getElementById('timetableImage');
    const direct = document.getElementById('timetableDirectLink');
    const label = document.getElementById('timetableModeLabel');
    const error = document.getElementById('timetableImageError');
    const close = document.getElementById('timetableCloseBtn');
    if(!dialog || !img || !direct || !label || !error || !close) return;

    let previousFocus = null;
    const currentTheme = () => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

    function syncTimetable() {
      const theme = currentTheme(), url = images[theme];
      label.textContent = theme === 'light' ? 'Light theme timetable' : 'Dark theme timetable';
      direct.href = url;
      if(img.getAttribute('src') !== url) {
        error.hidden = true;
        img.hidden = false;
        img.src = url;
      }
    }

    function openTimetable(opener) {
      previousFocus = opener || document.activeElement;
      const mobile = document.getElementById('mobileMenu');
      if(mobile && mobile.classList.contains('open')){
        mobile.classList.remove('open');
        mobile.setAttribute('aria-hidden','true');
      }
      syncTimetable();
      dialog.classList.add('open');
      dialog.setAttribute('aria-hidden','false');
      document.body.classList.add('locked');
      close.focus();
    }

    function closeTimetable() {
      dialog.classList.remove('open');
      dialog.setAttribute('aria-hidden','true');
      document.body.classList.remove('locked');
      if(previousFocus && document.contains(previousFocus) && !previousFocus.closest('#mobileMenu')) previousFocus.focus();
      else document.getElementById('timetableHeaderBtn')?.focus();
    }

    document.querySelectorAll('[data-timetable]').forEach(trigger => {
      trigger.addEventListener('click', event => {
        event.preventDefault();
        openTimetable(trigger);
      });
    });
    close.addEventListener('click',closeTimetable);
    dialog.addEventListener('click',event => {
      if(event.target === dialog) closeTimetable();
    });
    document.addEventListener('keydown',event => {
      if(!dialog.classList.contains('open')) return;
      if(event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeTimetable();
      } else if(event.key === 'Tab') {
        const focusables=[close,direct];
        if(event.shiftKey && document.activeElement===focusables[0]) {
          event.preventDefault();focusables[focusables.length-1].focus();
        } else if(!event.shiftKey && document.activeElement===focusables[focusables.length-1]) {
          event.preventDefault();focusables[0].focus();
        }
      }
    },true);

    img.addEventListener('load',()=>{img.hidden=false;error.hidden=true});
    img.addEventListener('error',()=>{img.hidden=true;error.hidden=false});
    new MutationObserver(()=>{
      if(dialog.classList.contains('open')) syncTimetable();
    }).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',setupTimetable,{once:true});
  else setupTimetable();
})();