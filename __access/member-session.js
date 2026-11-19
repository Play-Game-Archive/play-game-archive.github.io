(() => {
  'use strict';
  function call(type, data = {}) {
    const worker = navigator.serviceWorker?.controller;
    if (!worker) return Promise.reject(new Error('资料馆访问服务尚未就绪。'));
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => {
        channel.port1.close();
        reject(new Error('请求超时，请重试。'));
      }, 30000);
      channel.port1.onmessage = event => {
        clearTimeout(timer);
        channel.port1.close();
        if (event.data?.ok) resolve(event.data.result);
        else reject(new Error(event.data?.error || '连接失败，请重试。'));
      };
      worker.postMessage({ type, ...data }, [channel.port2]);
    });
  }

  window.PlayGameMember = {
    login: (token, expiresIn, unlock) => call('login', { token, expiresIn, unlock }),
    session: () => call('session'),
    account: () => call('account'),
    logout: () => call('logout')
  };
})();
