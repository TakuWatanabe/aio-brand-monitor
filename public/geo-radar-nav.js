/**
 * GEO Radar Nav Injector
 * Injects the GEO Radar navigation link into the existing sidebar.
 */
(function () {
  function injectGeoRadarNav() {
    const sbNav = document.querySelector('.sb-nav');
    if (!sbNav) return;
    if (document.querySelector('.nav-item-geo-radar')) return;

    const sections = Array.from(sbNav.querySelectorAll('.sb-section'));
    const reportSection = sections.find(s => s.textContent.trim() === 'レポート');

    const geoSection = document.createElement('div');
    geoSection.className = 'sb-section';
    geoSection.textContent = 'GEO';

    const geoNavItem = document.createElement('div');
    geoNavItem.className = 'nav-item nav-item-geo-radar';
    geoNavItem.innerHTML = '<span class="nav-icon">📡</span>GEO Radar <span style="background:#0EA5E9;color:#fff;font-size:10px;padding:1px 6px;border-radius:10px;margin-left:4px;font-weight:700;vertical-align:middle;">NEW</span>';
    geoNavItem.onclick = function () { window.location.href = '/geo-radar.html'; };

    if (reportSection) {
      sbNav.insertBefore(geoSection, reportSection);
      sbNav.insertBefore(geoNavItem, reportSection);
    } else {
      sbNav.appendChild(geoSection);
      sbNav.appendChild(geoNavItem);
    }

    if (window.location.pathname.includes('geo-radar')) {
      geoNavItem.classList.add('active');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectGeoRadarNav);
  } else {
    injectGeoRadarNav();
  }
  setTimeout(injectGeoRadarNav, 800);
  setTimeout(injectGeoRadarNav, 2000);
})();
