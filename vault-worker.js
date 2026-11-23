'use strict';

const api = 'https://api.github.com/';
const owner = 'Play-Game-Archive';
const ownerId = 358516810;
const repo = 'repos/' + owner + '/play-game-archive-notes';
const revision = 'd7ad425b166c961b29e62bee0b49a47c823988dc';
const oauthKeyPath = 'contents/reading-envelope.json?ref=owner-access';
const publicFiles = new Set([
  '/__access/favicon.ico','/__access/app-icon-32.png','/__access/app-icon.svg','/__access/app-icon-180.png','/__access/app-icon-192.png','/__access/app-icon-512.png','/__access/site.webmanifest',
  '/vault-worker.js', '/__access/login.html', '/__access/github-callback.html', '/__access/login.css',
  '/__access/brand-en.svg', '/__access/brand-zh.svg', '/__access/member-protect.js', '/__access/member-session.js', '/__access/member-login.js'
]);
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
const forcedHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer'
};
const pagePolicy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://api.github.com; frame-src 'self' blob:; base-uri 'none'; object-src 'none'; frame-ancestors 'self'";
const database = new Promise((resolve, reject) => {
  const request = indexedDB.open('play-game-archive-github-oauth', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('session');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

function db(type, value) {
  return database.then(store => new Promise((resolve, reject) => {
    const tx = store.transaction('session', type === 'get' ? 'readonly' : 'readwrite');
    const bucket = tx.objectStore('session');
    const command = type === 'get' ? bucket.get('owner') : type === 'put' ? bucket.put(value, 'owner') : bucket.delete('owner');
    tx.oncomplete = () => resolve(command.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

let state, manifestPromise = null, generation = 0;
async function session() {
  if (state === undefined) {
    const before = generation;
    const stored = await db('get');
    if (before === generation && state === undefined) state = stored || null;
  }
  if (state && state.expires <= Date.now()) await forget();
  return state;
}
async function forget() {
  state = null;
  manifestPromise = null;
  generation++;
  await db('delete');
  const tabs = await self.clients.matchAll({ type: 'window' });
  tabs.forEach(tab => tab.postMessage({ type: 'private-logout' }));
}

async function github(path, token, raw = false) {
  const response = await fetch(new URL(path, api), {
    headers: { Authorization: 'Bearer ' + token, Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json' },
    credentials: 'omit', cache: 'no-store', redirect: 'error'
  });
  if (!response.ok) {
    const error = new Error(response.status === 401 ? 'GitHub 授权已过期，请重新登入。' :
      response.status === 403 || response.status === 404 ? '请检查资料馆 GitHub App 的私有仓库权限。' : 'GitHub 连接暂时失败。');
    error.status = response.status;
    throw error;
  }
  return raw ? response.arrayBuffer() : response.json();
}
function vaultPath(path) {
  return repo + '/contents/' + path + '?ref=' + revision;
}
function unbase64(value) {
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), s => s.charCodeAt(0));
}
async function decrypt(key, bytes, name) {
  if (bytes.byteLength < 29) throw new Error('资料馆文件不完整。');
  const view = new Uint8Array(bytes);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: view.subarray(0, 12),
    additionalData: encoder.encode('play-game-vault:v1:' + name) }, key, view.subarray(12));
}
async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}
async function manifest(active) {
  const encrypted = await github(vaultPath('manifest.bin'), active.token, true);
  let clear;
  try {
    clear = await decrypt(active.key, encrypted, 'manifest');
  } catch {
    throw new Error('阅读密钥与此资料馆不匹配。');
  }
  const map = JSON.parse(decoder.decode(await inflate(clear)));
  if (map.version !== 1 || !map.files?.['index.html'] || !map.files?.['assets/catalog.js']) {
    throw new Error('资料馆目录文件格式有误。');
  }
  return map.files;
}

async function readingKey(token, unlock) {
  const encrypted = await github(repo + '/' + oauthKeyPath, token, true);
  const setting = JSON.parse(decoder.decode(encrypted));
  if (setting.version !== 1) throw new Error('资料馆阅读配置有误。');
  const packet = /^pga-oauth-key1\.([A-Za-z0-9_-]{50,200})$/.exec(setting?.value || '')?.[1];
  if (!packet) throw new Error('资料馆阅读配置有误。');
  const bytes = unbase64(packet);
  const wrappingKey = await crypto.subtle.importKey('raw', unbase64(unlock), 'AES-GCM', false, ['decrypt']);
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0,12),
    additionalData: encoder.encode('play-game-archive/oauth/reading-key/v1') }, wrappingKey, bytes.subarray(12));
  if (clear.byteLength !== 32) throw new Error('资料馆阅读配置有误。');
  return crypto.subtle.importKey('raw', clear, 'AES-GCM', false, ['decrypt']);
}

async function signIn(token, expiresIn, unlock) {
  if (typeof token !== 'string' || !/^ghu_[A-Za-z0-9_]{24,255}$/.test(token) ||
      !Number.isSafeInteger(expiresIn) || expiresIn < 60 || expiresIn > 28800 ||
      typeof unlock !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(unlock)) {
    throw new Error('GitHub 登入响应有误。');
  }
  const before = generation;
  const profile = await github('user', token);
  if (profile.id !== ownerId || profile.login !== owner) throw new Error('此 GitHub 账号没有资料馆访问权限。');
  const repository = await github(repo, token);
  if (!repository.private || repository.owner?.id !== ownerId) throw new Error('私有资料馆仓库不可用。');
  const key = await readingKey(token, unlock);
  const next = { username: owner, token, key, expires: Date.now() + expiresIn * 1000 };
  const files = await manifest(next);
  if (generation !== before) throw new Error('会话已变化，请重新登入。');
  await db('put', next);
  if (generation !== before) throw new Error('会话已变化，请重新登入。');
  state = next;
  manifestPromise = Promise.resolve(files);
  generation++;
  return { username: next.username };
}

async function receive(message) {
  switch (message.type) {
    case 'login':
      return signIn(message.token, message.expiresIn, message.unlock);
    case 'session': {
      const active = await session();
      return active ? { username: active.username } : null;
    }
    case 'account': {
      const active = await session();
      return active ? { username: active.username, token: active.token, id: ownerId } : null;
    }
    case 'logout':
      await forget();
      return null;
    default:
      throw new Error('无效的访问请求。');
  }
}

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  const port = event.ports[0];
  if (!port || !event.source?.url || new URL(event.source.url).origin !== self.location.origin) return;
  event.waitUntil(receive(event.data || {}).then(
    result => port.postMessage({ ok: true, result }),
    error => port.postMessage({ ok: false, error: error.message })
  ));
});

const encryptedRequests = new Map();
let running = 0;
const queue = [];
async function download(path, token) {
  if (running >= 8) await new Promise(resolve => queue.push(resolve));
  else running++;
  try {
    return await github(vaultPath(path), token, true);
  } finally {
    const resume = queue.shift();
    if (resume) resume();
    else running--;
  }
}
async function loadEncrypted(object, active) {
  const name = 'blobs/' + object.slice(0, 2) + '/' + object + '.bin';
  const cacheKey = new URL('/__access/cache/' + name, self.location.origin);
  const cache = await caches.open('play-game-encrypted-files-v1').catch(() => null);
  const cached = await cache?.match(cacheKey).catch(() => null);
  if (cached) return cached.arrayBuffer();
  if (encryptedRequests.has(object)) return encryptedRequests.get(object);
  const pending = download(name, active.token).then(async bytes => {
    await cache?.put(cacheKey, new Response(bytes)).catch(() => {});
    return bytes;
  }).finally(() => encryptedRequests.delete(object));
  encryptedRequests.set(object, pending);
  return pending;
}
async function openFile(active, path, change) {
  if (!manifestPromise) manifestPromise = manifest(active).catch(error => { manifestPromise = null; throw error; });
  const files = await manifestPromise;
  const record = Object.hasOwn(files, path) ? files[path] : null;
  if (!record) return null;
  const [object, type, compressed] = record;
  if (!/^[0-9a-f]{64}$/.test(object)) throw new Error('索引记录无效。');
  const bytes = await loadEncrypted(object, active);
  const clear = await decrypt(active.key, bytes, object);
  const body = compressed ? await inflate(clear) : clear;
  if (change !== generation || (await session()) !== active) return null;
  return new Response(body, {
    headers: { ...forcedHeaders, 'Content-Type': type,
      ...(type.startsWith('text/html') ? { 'Content-Security-Policy': pagePolicy } : {}) }
  });
}

async function loginPage() {
  const shell = await fetch('/__access/login.html', { cache: 'no-store' });
  return new Response(shell.body, { headers: { ...forcedHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
}
async function handle(event, url) {
  const request = event.request;
  const navigation = request.mode === 'navigate';
  const inactive = () => navigation ? loginPage() : new Response(null, { status: 401, headers: forcedHeaders });
  const active = await session();
  if (!active) return inactive();
  const change = generation;
  let path;
  try {
    path = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  } catch {
    return new Response(null, { status: 400, headers: forcedHeaders });
  }
  if (navigation && path && !path.endsWith('/') && !path.includes('.', path.lastIndexOf('/') + 1)) {
    return Response.redirect(new URL(url.pathname + '/' + url.search, url.origin), 302);
  }
  if (!path || path.endsWith('/')) path += 'index.html';
  try {
    const file = await openFile(active, path, change);
    if (change !== generation || !state) return inactive();
    if (file) return file;
    return new Response('未找到页面。', { status: 404, headers: { ...forcedHeaders, 'Content-Type': 'text/plain; charset=utf-8' } });
  } catch (error) {
    if (error.status === 401) {
      await forget();
      return inactive();
    }
    return new Response('资料馆暂时无法读取，请刷新重试。', {
      status: 502, headers: { ...forcedHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET' || publicFiles.has(url.pathname)) return;
  event.respondWith(handle(event, url));
});
