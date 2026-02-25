// ═══════════════════════════════════════════════════════
// APP.JS — Navigation, initialization, favicon
// ═══════════════════════════════════════════════════════

// ── Favicon (inline SVG, no external file needed) ───────
(function () {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <rect width="24" height="24" rx="4" fill="#ff6b35"/>
    <path d="M3 3v18" stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="round"/>
    <path d="M3 3h18" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M3 21h18" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M3 8.5h18" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M9 8.5v12.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`;
  const link = document.getElementById('favicon');
  if (link) link.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
})();

// ── Page registry ────────────────────────────────────────
const PAGES = { home: 'page-home', gen: 'page-gen', val: 'page-val' };

const PAGE_TITLES = {
  home: ['CICS<span>TOOLS</span>',  'MAINFRAME TESTING TOOLKIT · COMMAREA / CHANNELS'],
  gen:  ['CICS<span>TRACE</span>',  'MAINFRAME MESSAGE GENERATOR · COMMAREA / CHANNELS'],
  val:  ['CICS<span>VALID</span>',  'MAINFRAME RESPONSE PARSER &amp; VALIDATOR · COMMAREA / CHANNELS'],
};

const PAGE_HEADER_ICONS = {
  home: '#icon-logo',
  gen:  '#icon-gen',
  val:  '#icon-logo-val',
};

let currentPage = 'home';

// ── Navigation ───────────────────────────────────────────
function goToTool(tool) {
  currentPage = tool;

  // Show/hide pages
  Object.entries(PAGES).forEach(([k, id]) =>
    document.getElementById(id).classList.toggle('active', k === tool));

  // Update header title & subtitle
  document.getElementById('headerTitle').innerHTML = PAGE_TITLES[tool][0];
  document.getElementById('headerSub').textContent = PAGE_TITLES[tool][1];

  // Update header logo icon
  const iconHref = PAGE_HEADER_ICONS[tool];
  document.getElementById('headerLogoBox').innerHTML =
    `<svg width="18" height="18" color="#fff"><use href="${iconHref}"/></svg>`;

  // Breadcrumb nav — empty on home, tool label on tools
  const nav = document.getElementById('appNav');
  if (tool === 'home') {
    nav.innerHTML = '';
  } else {
    const toolLabel = tool === 'gen' ? 'CICSTRACE' : 'CICSVALID';
    nav.innerHTML = `
      <button onclick="goToTool('home')">
        <svg class="icon icon-sm"><use href="#icon-home"></use></svg> INICIO
      </button>
      <span class="current">${toolLabel}</span>`;
  }

  // Refresh validator layout summary when switching to validator
  if (tool === 'val') valRefreshLayoutSummary();

  window.scrollTo(0, 0);
}

function goHome() { goToTool('home'); }

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Start on home page
  goToTool('home');

  // Init validator live trace counter
  valInitTraceCounter();
});
