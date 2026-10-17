/* Shared by the current and classic entry points; no application settings are changed. */
(() => {
  const marker = '8apdf_premium_name_onboarding_v1';
  const nameKeys = ['eightapdf_user_name_v2', 'eightapdf_user_name'];
  const read = (key) => {
    for (const kind of ['localStorage', 'sessionStorage']) {
      try { const value = window[kind].getItem(key); if (value) return value; } catch {}
    }
    return '';
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, value); return true; } catch {}
    try { sessionStorage.setItem(key, value); } catch {}
    return false;
  };
  window.initNameOnboarding = ({onConfirm, onFinish}) => {
    if (read(marker) === 'complete') return false;
    const modal = document.getElementById('nameModal');
    const form = document.getElementById('nameForm');
    const input = document.getElementById('nameInput');
    const button = form.querySelector('button');
    const feedback = document.getElementById('nameFeedback');
    const previousFocus = document.activeElement;
    let submitting = false;
    input.value = nameKeys.map(read).find(value => value.trim()) || '';
    const update = () => {
      button.disabled = submitting || !input.value.trim();
      input.removeAttribute('aria-invalid');
      feedback.textContent = 'Just your name. Make yourself at home.';
    };
    update();
    input.addEventListener('input', update);
    document.body.classList.add('locked');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    // Prevent keyboard and assistive-technology navigation behind the dialog.
    const siblings = [...document.body.children].filter(node => node !== modal && !node.inert);
    siblings.forEach(node => { node.inert = true; });
    const observer = new MutationObserver(() => {
      for (const node of document.body.children) {
        if (node !== modal && !node.inert) { siblings.push(node); node.inert = true; }
      }
    });
    observer.observe(document.body, {childList: true});
    const keepFocus = event => {
      if (!modal.contains(event.target)) (submitting ? modal : input).focus({preventScroll: true});
    };
    document.addEventListener('focusin', keepFocus);
    input.focus({preventScroll: true});
    const trapFocus = event => {
      if (event.key !== 'Tab') return;
      if (submitting) { event.preventDefault(); return; }
      const controls = [...modal.querySelectorAll('input, button')].filter(node => !node.disabled);
      if (!controls.length) { event.preventDefault(); modal.focus(); return; }
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    modal.addEventListener('keydown', trapFocus);
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (submitting) return;
      const name = input.value.trim();
      if (!name) {
        input.setAttribute('aria-invalid', 'true');
        feedback.textContent = 'Please enter your name to continue.';
        input.focus();
        return;
      }
      submitting = true;
      input.value = name;
      input.readOnly = true;
      button.disabled = true;
      button.querySelector('span').textContent = 'Opening your workspace';
      nameKeys.forEach(key => write(key, name));
      onConfirm(name);
      const persisted = write(marker, 'complete');
      document.getElementById('nameWelcomeTitle').textContent = 'Welcome, ' + name + '.';
      document.getElementById('nameWelcomeDetail').textContent = persisted
        ? 'Your workspace is ready.'
        : 'Your workspace is ready. Browser storage is unavailable; your name may not be remembered next visit.';
      modal.dataset.phase = 'welcome';
      form.inert = true;
      modal.focus({preventScroll: true});
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
      setTimeout(() => {
        modal.classList.add('name-leaving');
        setTimeout(() => {
          modal.classList.remove('show', 'name-leaving');
          modal.setAttribute('aria-hidden', 'true');
          document.body.classList.remove('locked');
          observer.disconnect();
          document.removeEventListener('focusin', keepFocus);
          siblings.forEach(node => { node.inert = false; });
          modal.removeEventListener('keydown', trapFocus);
          const target = previousFocus && previousFocus !== document.body ? previousFocus : document.getElementById('profileBtn');
          target?.focus({preventScroll: true});
          onFinish();
        }, reduced ? 0 : 280);
      }, reduced ? 650 : persisted ? 1400 : 2600);
    });
    return true;
  };
})();
