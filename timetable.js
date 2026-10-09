(() => {
  function setupTimetable() {
    const dialog = document.getElementById('timetableOverlay'); const close = document.getElementById('timetableCloseBtn');
    if (!dialog || !close) return; let previousFocus = null;
    const open = opener => { previousFocus = opener || document.activeElement; document.getElementById('mobileMenu')?.classList.remove('open'); dialog.classList.add('open'); dialog.setAttribute('aria-hidden','false'); document.body.classList.add('locked'); close.focus(); };
    const hide = () => { dialog.classList.remove('open'); dialog.setAttribute('aria-hidden','true'); document.body.classList.remove('locked'); if (previousFocus && document.contains(previousFocus)) previousFocus.focus(); };
    document.querySelectorAll('[data-timetable]').forEach(trigger => trigger.addEventListener('click', e => { e.preventDefault(); open(trigger); }));
    close.addEventListener('click', hide); dialog.addEventListener('click', e => { if (e.target === dialog) hide(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && dialog.classList.contains('open')) { e.preventDefault(); hide(); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupTimetable, { once:true }); else setupTimetable();
})();
