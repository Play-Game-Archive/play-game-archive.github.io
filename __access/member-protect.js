(() => {
  'use strict';
  const privateBody = document.body;
  const forceLogin = () => {
    privateBody.hidden = true;
    try { sessionStorage.removeItem('play-game-archive:github-session'); } catch {}
    location.reload();
  };
  navigator.serviceWorker?.addEventListener('message', event => {
    if (event.data?.type === 'private-logout') forceLogin();
  });
  addEventListener('pagehide', () => { privateBody.hidden = true; });
  addEventListener('pageshow', async () => {
    try {
      if (await window.PlayGameMember.session()) privateBody.hidden = false;
      else forceLogin();
    } catch {
      forceLogin();
    }
  });
})();
