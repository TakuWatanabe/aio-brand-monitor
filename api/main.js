/**
 * /api/main.js
 * Serves index.html with GEO Radar navigation link injected.
 * Routed to "/" via vercel.json rewrite.
 */
const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  try {
    const htmlPath = path.join(process.cwd(), 'public', 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    const insertBefore = '<div class="sb-section">レポート</div>';
    const geoInjection = `
      <div class="sb-section">GEO</div>
      <div class="nav-item" onclick="window.location.href='/geo-radar.html'">
        <span class="nav-icon">📡</span>GEO Radar
        <span style="background:#0EA5E9;color:#fff;font-size:10px;padding:1px 6px;border-radius:10px;margin-left:4px;font-weight:700;vertical-align:middle;">NEW</span>
      </div>
`;

    if (html.includes(insertBefore)) {
      html = html.replace(insertBefore, geoInjection + '      ' + insertBefore);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).send(html);
  } catch (err) {
    res.setHeader('Location', '/index.html');
    res.status(302).end();
  }
};
