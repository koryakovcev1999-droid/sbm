const back = document.querySelector('.profile-back');

window.addEventListener('pagehide', () => {
  window.sessionStorage.setItem('sbm-return-from-profile', '1');
});

back?.addEventListener('click', (event) => {
  if (!document.referrer || window.history.length < 2) return;

  const previousPage = new URL(document.referrer);
  const homePage = new URL('./', window.location.href);
  const cameFromHome = previousPage.origin === homePage.origin &&
    (previousPage.pathname === homePage.pathname || previousPage.pathname === `${homePage.pathname}index.html`);

  if (cameFromHome) {
    event.preventDefault();
    window.history.back();
  }
});
