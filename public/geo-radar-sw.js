/**
 * GEO Radar Service Worker
 * Intercepts requests to the main dashboard and injects the GEO Radar nav link.
 * Installed when user first visits /geo-radar.html
 */

const CACHE_VERSION = 'geo-radar-v1';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (
    event.request.method !== 'GET' ||
    (url.pathname !== '/' && url.pathname !== '/index.html')
  ) {
    return;
  }

  const acceptHeader = event.request.headers.get('accept') || '';
  if (!acceptHeader.includes('text/html')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        return response.text().then(html => {
          const insertBefore = '<div class="sb-section">レポート</div>';
          const geoInjection =
            '\n      <div class="sb-section">GEO</div>' +
            '\n      <div class="nav-item" onclick="window.location.href=\'/geo-radar.html\'">' +
            '<span class="nav-icon">📡</span>GEO Radar ' +
            '<span style="background:#0EA5E9;color:#fff;font-size:10px;padding:1px 6px;' +
            'border-radius:10px;margin-left:4px;font-weight:700;vertical-align:middle;">NEW</span>' +
            '</div>\n';

          const modified = html.includes(insertBefore)
            ? html.replace(insertBefore, geoInjection + '      ' + insertBefore)
            : html;

          return new Response(modified, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
          });
        });
      })
      .catch(() => fetch(event.request))
  );
});
