/* 缓存策略（针对国内访问 github.io 很慢的情况优化）
   1. 页面：先等网络最多 2.2 秒，超时就先用缓存渲染，同时后台把新版本存进去。
      → 第一次打开还是要等网络；第二次、第三次打开几乎瞬间出来。
   2. 照片、图标：缓存优先，看过一次就不再下载。
   改完内容看不到更新时，把下面的 v6 改成 v7 再推一次即可强制刷新。 */
const CACHE = 'our-story-v6';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];
const NAV_TIMEOUT = 2200;

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function put(req, res) {
  const copy = res.clone();
  caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // 页面：2.2 秒内拿得到网络就用网络，拿不到就先给缓存
  if (req.mode === 'navigate') {
    e.respondWith(new Promise(resolve => {
      let settled = false;
      const finish = res => { if (!settled && res && res.status) { settled = true; resolve(res); } };

      const fromCache = () =>
        caches.match(req)
          .then(hit => hit || caches.match('./index.html'))
          .then(hit => { if (hit) finish(hit); });   // 没有缓存就什么都不做，等网络

      const timer = setTimeout(fromCache, NAV_TIMEOUT);

      fetch(req)
        .then(res => {
          clearTimeout(timer);
          put(req, res);
          finish(res);
        })
        .catch(() => {
          clearTimeout(timer);
          fromCache();
        });
    }));
    return;
  }

  // 静态资源：有缓存直接用
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        put(req, res);
        return res;
      });
    })
  );
});
