/* Theme-aware timetable feature. No changes to the original 8aPDF theme or app logic. */
(() => {
  const images = Object.freeze({
    light:'https://www.image2url.com/r2/default/images/1791028856977-b85d72c3-a9e6-4b73-a344-1ec7a20a04fe.png',
    dark:'https://www.image2url.com/r2/default/images/1791028831646-7028a7af-b905-4790-a776-4fb43399cb79.png'
  });

  function preloadTimetables() {
      Object.values(images).forEach(url => { const image = new Image(); image.decoding = 'async'; image.fetchPriority = 'high'; image.src = url; });
    }

  function setupTimetable() {
    const dialog = document.getElementById('timetableOverlay');
    const img = document.getElementById('timetableImage');
    const direct = document.getElementById('timetableDirectLink');
    const label = document.getElementById('timetableModeLabel');
    const error = document.getElementById('timetableImageError');
    const close = document.getElementById('timetableCloseBtn');
    if(!dialog || !img || !direct || !label || !error || !close) return;
    preloadTimetables();

    let previousFocus = null;
    const currentTheme = () => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

    function syncTimetable() {
      const theme = currentTheme(), url = images[theme];
      label.textContent = theme === 'light' ? 'Light theme timetable' : 'Dark theme timetable';
      direct.href = url;
      if(img.getAttribute('src') !== url) {
        error.hidden = true;
        img.hidden = false;
        img.decoding = 'async';
        img.fetchPriority = 'high';
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