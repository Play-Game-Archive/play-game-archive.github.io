(() => {
  'use strict';
  const button = document.querySelector('[data-archive-account]');
  if (!button) return;
  const api = 'https://api.github.com/';
  const repository = 'play-game-archive-notes';
  const key = 'play-game-archive:github-session';
  const fineGrained = /^github_pat_[A-Za-z0-9_]{40,255}$/;
  const listeners = new Set();
  let session = null, generation = 0;

  const dialog = document.createElement('dialog');
  dialog.className = 'archive-account-dialog';
  dialog.innerHTML = `<form class="archive-account-form">
    <header><h2>登录</h2><button type="button" data-account-close aria-label="关闭">×</button></header>
    <p class="account-intent" hidden></p>
    <label>GitHub 用户名<input name="username" autocomplete="username" required maxlength="39" spellcheck="false" value="Play-Game-Archive"></label>
    <label>笔记访问令牌<input name="token" type="password" autocomplete="current-password" required maxlength="266"></label>
    <p class="account-hint"><a href="https://github.com/settings/personal-access-tokens/new?name=Play%2FGame%20Archive%20Notes&amp;contents=write" target="_blank" rel="noopener noreferrer">创建 GitHub 令牌 ↗</a> · 仅选私有仓库 play-game-archive-notes，授予 Contents 读写权限。</p>
    <button class="account-submit" type="submit">登录</button>
    <p class="account-status" role="status"></p>
  </form>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form');
  const status = form.querySelector('.account-status');
  const intent = form.querySelector('.account-intent');
  const submit = form.querySelector('.account-submit');

  function failure(status, message) {
    return Object.assign(new Error(message), { status });
  }

  async function github(path, token, data) {
    const headers = { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token };
    if (data !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(new URL(path, api), {
      method: data === undefined ? 'GET' : 'PUT', credentials: 'omit', cache: 'no-store',
      redirect: 'error', headers, body: data === undefined ? undefined : JSON.stringify(data)
    });
    if (response.status === 401) throw failure(401, '访问令牌已失效。');
    if (response.status === 403) throw failure(403, '请检查笔记仓库的 Contents 读写权限。');
    if (response.status === 404) throw failure(404, '找不到私有笔记仓库或笔记文件，请检查令牌的仓库范围。');
    if (!response.ok) throw failure(response.status, 'GitHub 暂时无法保存此操作。');
    return response.json();
  }

  async function verify(username, token) {
    if (!fineGrained.test(token)) throw new Error('请输入 GitHub 的细粒度访问令牌。');
    if (!/^[A-Za-z0-9-]{1,39}$/.test(username)) throw new Error('请输入 GitHub 用户名。');
    const user = await github('user', token);
    if (user.login.toLowerCase() !== username.toLowerCase()) throw new Error('访问令牌属于另一个 GitHub 用户。');
    const path = 'repos/' + encodeURIComponent(user.login) + '/' + repository;
    const repo = await github(path, token);
    if (!repo.private || repo.owner.id !== user.id || repo.archived || repo.disabled) {
      throw new Error('请使用当前账号下可读写的私有笔记仓库。');
    }
    const active = { account: { id: 'github-' + user.id, username: user.login }, userId: user.id, token, path };
    await readNotebook(active);
    return active;
  }

  function change(next) {
    session = next;
    generation++;
    try {
      if (next) sessionStorage.setItem(key, JSON.stringify({ username: next.account.username, token: next.token }));
      else sessionStorage.removeItem(key);
    } catch {}
    button.textContent = next ? '退登' : '登录';
    button.title = next?.account.username || '';
    for (const action of listeners) action(next?.account || null);
  }

  function open(message = '') {
    form.elements.token.value = '';
    status.textContent = '';
    intent.textContent = message;
    intent.hidden = !message;
    if (!dialog.open) dialog.showModal();
  }

  function encode(value) {
    const bytes = new TextEncoder().encode(value), chunks = [];
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
    }
    return btoa(chunks.join(''));
  }

  async function readNotebook(active) {
    const file = await github(active.path + '/contents/notes.json', active.token);
    if (file.type !== 'file' || file.encoding !== 'base64' || !file.sha) throw new Error('笔记文件格式无法读取。');
    const bytes = Uint8Array.from(atob(file.content.replace(/\s/g, '')), char => char.charCodeAt(0));
    const notebook = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (notebook.format !== 1 || !Array.isArray(notebook.notes) ||
        notebook.notes.some(note => !note || !/^[\w-]{1,100}$/.test(note.id || '') ||
          !/^[0-9a-f]{14}$/.test(note.entryId || '') || !Number.isSafeInteger(note.version) ||
          typeof note.quote !== 'string' || typeof note.createdAt !== 'string' ||
          !Number.isFinite(Date.parse(note.createdAt))) ||
        new Set(notebook.notes.map(note => note.id)).size !== notebook.notes.length) {
      throw new Error('笔记文件校验失败，原文件已保留。');
    }
    return { notes: notebook.notes, sha: file.sha };
  }

  async function saveNotebook(active, { note, expectedVersion }) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const repo = await github(active.path, active.token);
      if (!repo.private || repo.owner.id !== active.userId) throw new Error('请确认笔记仓库仍为私有。');
      const { notes, sha } = await readNotebook(active);
      const index = notes.findIndex(existing => existing.id === note.id);
      const previous = notes[index];
      if ((previous?.version || 0) !== (expectedVersion || 0)) {
        throw failure(409, '此笔记已在另一处编辑。');
      }
      if (session !== active) throw failure(401, '请重新登录。');
      const { conflict, dirty, ...clean } = note;
      const now = new Date().toISOString();
      const saved = { ...clean, author: 'Ivan', createdAt: previous?.createdAt || note.createdAt || now,
        updatedAt: now, version: (previous?.version || 0) + 1 };
      if (index === -1) notes.push(saved);
      else notes[index] = saved;
      const content = encode(JSON.stringify({ format: 1, notes }, null, 2) + '\n');
      if (content.length > 1_300_000) throw new Error('笔记仓库接近容量上限。本机草稿已保留。');
      try {
        await github(active.path + '/contents/notes.json', active.token, { message: '更新阅读笔记', content, sha });
        return saved;
      } catch (error) {
        if (error.status !== 409 || attempt === 2) throw error;
      }
    }
  }

  async function request(path, data) {
    const active = session;
    if (!active || path !== 'api/notes') throw failure(401, '请先登录。');
    try {
      return data === undefined ? (await readNotebook(active)).notes : await saveNotebook(active, data);
    } catch (error) {
      if (error.status === 401 && session === active) change(null);
      throw error;
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = '正在连接 GitHub…';
    const before = generation;
    try {
      const verified = await verify(form.elements.username.value.trim(), form.elements.token.value.trim());
      if (generation !== before || !dialog.open) return;
      change(verified);
      dialog.close();
    } catch (error) {
      status.textContent = error.message || 'GitHub 暂时无法连接，请重试。';
    } finally {
      submit.disabled = false;
    }
  });
  form.querySelector('[data-account-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { form.elements.token.value = ''; generation++; });
  button.addEventListener('click', () => { if (session) change(null); else open(); });

  async function restore() {
    try {
      const stored = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (!stored) return;
      const before = generation;
      const verified = await verify(stored.username, stored.token);
      if (generation === before && !dialog.open) change(verified);
    } catch (error) {
      if (error.status === 401) change(null);
    }
  }

  window.LibraryAccount = {
    get current() { return session?.account || null; },
    open,
    require(message) { if (session) return true; open(message); return false; },
    onChange(action) { listeners.add(action); },
    request,
    ready: restore()
  };
})();
