(() => {
  'use strict';
  const form = document.querySelector('form');
  const status = document.querySelector('[role="status"]');
  const submit = form.querySelector('button[type="submit"]');

  async function activate() {
    if (!navigator.serviceWorker || !window.crypto?.subtle) {
      throw new Error('请在普通浏览窗口中打开资料馆。');
    }
    const registration = await navigator.serviceWorker.register('/vault-worker.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve, reject) => {
        const signal = new AbortController();
        const timeout = setTimeout(() => {
          signal.abort();
          reject(new Error('访问服务启动超时，请刷新。'));
        }, 8000);
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true, signal: signal.signal });
        if (navigator.serviceWorker.controller) {
          signal.abort();
          clearTimeout(timeout);
          resolve();
        }
      });
    }
    return registration;
  }

  async function openArchive() {
    const retry = new URL(location.href);
    if (retry.pathname.startsWith('/__access/')) retry.pathname = '/';
    if (retry.searchParams.has('sign-in')) retry.searchParams.delete('sign-in');
    if (retry.href === location.href) location.reload();
    else location.replace(retry);
  }

  const ready = activate();
  ready.then(() => window.PlayGameMember.session()).then(session => {
    if (session) return openArchive();
    submit.disabled = false;
    status.textContent = '';
  }).catch(error => {
    submit.disabled = false;
    status.textContent = error.message;
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = '正在验证…';
    try {
      await ready;
      const key = form.elements.readingKey.files[0];
      if (!key || key.size > 512) throw new Error('请选择资料馆阅读密钥文件。');
      await window.PlayGameMember.login(form.elements.username.value.trim(),
        form.elements.token.value.trim(), (await key.text()).trim());
      form.reset();
      await openArchive();
    } catch (error) {
      status.textContent = error.message || '登录暂时失败，请稍后重试。';
      submit.disabled = false;
    }
  });
})();
