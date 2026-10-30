(() => {
  const visible = element => element.getClientRects().length > 0;
  const dialog = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].find(visible);
  if (dialog) {
    // ReadSpace Modal already owns its Escape close handler and focus cleanup.
    document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
    return true;
  }
  const preferences = document.querySelector('.reader-toolbar button[aria-label="阅读设置"][aria-expanded="true"]');
  if (preferences && visible(preferences)) { preferences.click(); return true; }
  return false;
})()
