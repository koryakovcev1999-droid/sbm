const assistantBack = document.querySelector('.assistant-back');
window.addEventListener('pagehide', () => {
  sessionStorage.setItem('sbm-return-from-profile', '1');
});
assistantBack?.addEventListener('click', event => {
  if (!document.referrer || history.length < 2) return;
  const previous = new URL(document.referrer);
  const home = new URL('./', location.href);
  if (previous.origin === home.origin && (previous.pathname === home.pathname || previous.pathname === home.pathname + 'index.html')) {
    event.preventDefault();
    history.back();
  }
});
