(() => {
  'use strict';
  const client = 'Iv23lip0I61tWc8mobRq';
  const relay = 'https://play-game-archive-login-f0ca64.netlify.app/.netlify/functions/github-login';
  const callbackPath = '/__access/github-callback.html';
  const callback = location.origin + callbackPath;
  const stateKey = 'play-game-archive:oauth-state';
  const status = document.querySelector('[role=status]');
  const button = document.querySelector('button[data-github-login]');

  function random() {
    return base64url(crypto.getRandomValues(new Uint8Array(32)));
  }

  function base64url(bytes) {
    return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  }

  function returnTo(address) {
    try {
      const url = new URL(address, location.href);
      return url.origin === location.origin && !url.pathname.startsWith('/__access/') ? url.href : location.origin + '/';
    } catch { return location.origin + '/'; }
  }

  async function activate() {
    if (!navigator.serviceWorker || !crypto.subtle) throw new Error('请在普通浏览窗口中打开资料馆。');
    const worker = new URL('/vault-worker.js?auth=github-1', location.origin);
    const controlled = () => navigator.serviceWorker.controller?.scriptURL === worker.href;
    await navigator.serviceWorker.register(worker, { scope: '/' });
    if (controlled()) return;
    await new Promise((resolve, reject) => {
      const abort = new AbortController();
      const end = () => {
        if (controlled()) {
          clearTimeout(timer);
          abort.abort();
          resolve();
        }
      };
      const timer = setTimeout(() => { abort.abort(); reject(new Error('访问服务启动超时，请刷新。')); }, 10000);
      navigator.serviceWorker.addEventListener('controllerchange', end, { signal: abort.signal });
      end();
    });
  }

  async function begin() {
    const verifier = random(), state = random();
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    sessionStorage.setItem(stateKey, JSON.stringify({ state, verifier, date: Date.now(), returnTo: returnTo(location.href) }));
    const url = new URL('https://github.com/login/oauth/authorize');
    url.search = new URLSearchParams({ client_id: client, redirect_uri: callback, state,
      code_challenge: base64url(new Uint8Array(bytes)), code_challenge_method: 'S256',
      login: 'Play-Game-Archive', allow_signup: 'false' });
    location.assign(url);
  }

  async function redeem() {
    const query = new URLSearchParams(location.search);
    history.replaceState(null, '', callbackPath);
    const pending = JSON.parse(sessionStorage.getItem(stateKey) || 'null');
    sessionStorage.removeItem(stateKey);
    if (query.has('error')) throw new Error('GitHub 登录已取消。');
    if (!pending || query.get('state') !== pending.state || !query.get('code') ||
        Date.now() - pending.date > 30 * 60000) throw new Error('本次登录已失效，请重新登录。');
    status.textContent = '正在核对 GitHub 授权…';
    const res = await fetch(relay, { method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: query.get('code'), verifier: pending.verifier }),
      signal: AbortSignal.timeout(25000) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '登录暂时失败。');
    await activate();
    await window.PlayGameMember.login(data.token, data.expiresIn, data.unlock);
    location.replace(returnTo(pending.returnTo));
  }

  const whenReady = location.pathname === callbackPath && location.search ? redeem() :
    activate().then(() => window.PlayGameMember.session()).then(session => {
      if (session) {
        const target = returnTo(location.href);
        if (target === location.href) location.reload();
        else location.replace(target);
      } else {
        status.textContent = '';
        button.disabled = false;
      }
    });
  whenReady.catch(error => {
    status.textContent = error.message || '暂时无法完成登录。';
    button.disabled = false;
  });
  button.addEventListener('click', () => {
    button.disabled = true;
    status.textContent = '正在打开 GitHub…';
    begin().catch(error => {
      status.textContent = error.message || '暂时无法打开 GitHub。';
      button.disabled = false;
    });
  });
})();
