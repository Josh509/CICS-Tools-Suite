// ═══════════════════════════════════════════════════════
// UTILS.JS — Shared utility functions
// ═══════════════════════════════════════════════════════

/**
 * Detect which columns correspond to which fields
 * from a pasted table header row.
 */
function detectColumns(headers) {
  const find = (keys) => {
    for (const h of headers)
      for (const k of keys)
        if (h.includes(k)) return headers.indexOf(h);
    return -1;
  };
  return {
    campo:  find(['campo', 'field', 'nombre']),
    largo:  find(['largo', 'length', 'long']),
    tipo:   find(['tipo', 'type']),
    desc:   find(['desc', 'descripcion', 'description']),
    oblig:  find(['oblig', 'required', 'req', 'mand']),
    vals:   find(['valor', 'values', 'val']),
    occurs: find(['occurs', 'occ']),
    max:    find(['max', 'maxi']),
  };
}

/** Safely get a cell value from a split row. */
function getCellVal(cells, idx) {
  if (idx < 0 || idx >= cells.length) return '';
  return (cells[idx] || '').replace(/\./g, '').trim();
}

/** Normalize a COBOL type string. */
function cleanTipo(t) {
  return (t || '').replace(/\s/g, '').replace(/\.$/, '');
}

/**
 * Parse a comma/semicolon-separated list of allowed values.
 * Strips surrounding single-quotes.
 */
function parseValues(vals) {
  if (!vals) return [];
  const parts = vals.split(/[,;]/).map(v => v.trim().replace(/^'|'$/g, '').trim());
  if (parts.length < 2) return [];
  return parts.filter(v => v.length > 0 && v.length < 25);
}

/** Get a sensible placeholder for a field input. */
function getPlaceholder(f) {
  if (!f.tipo || f.tipo.startsWith('X')) return '_'.repeat(Math.min(f.largo || 10, 15));
  if (f.tipo.includes('V')) {
    const m = f.tipo.match(/9\((\d+)\)V9\((\d+)\)/);
    if (m) return '0'.repeat(parseInt(m[1])) + '.' + '0'.repeat(parseInt(m[2]));
  }
  return '0'.repeat(Math.min(f.largo || 6, 10));
}

/**
 * Format a field value to the exact width required by its COBOL type.
 */
function formatField(f, val) {
  const len = f.largo;
  if (!len) return '';
  const tipo = f.tipo || 'X';

  if (tipo.startsWith('X')) {
    return (val || '').substring(0, len).padEnd(len, ' ');
  }

  if (tipo.includes('V')) {
    const m = tipo.match(/9\((\d+)\)V9\((\d+)\)/);
    if (m) {
      const ip = parseInt(m[1]), dp = parseInt(m[2]);
      const num = parseFloat(val) || 0;
      const [iStr, dStr = ''] = num.toFixed(dp).replace('-', '').split('.');
      return iStr.padStart(ip, '0').substring(0, ip) + dStr.padEnd(dp, '0').substring(0, dp);
    }
  }

  if (tipo.startsWith('9')) {
    return (String(parseInt(val) || 0)).padStart(len, '0').substring(0, len);
  }

  return (val || '').substring(0, len).padEnd(len, ' ');
}

/** Sanitize a string to be safe as an HTML element id. */
function sanitizeId(s) {
  return (s || '').replace(/[^a-zA-Z0-9_]/g, '_');
}

/** Escape HTML special characters. */
function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ═══════════════════════════════════════════════════════
// CONFIRM MODAL
// ═══════════════════════════════════════════════════════
let _confirmCallback = null;

function showConfirm(title, message, fieldsList, question, onConfirm) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').innerHTML = message;
  document.getElementById('confirm-fields-list').innerHTML =
    fieldsList.map(e => `<div class="confirm-field-item">${e}</div>`).join('');
  document.getElementById('confirm-question').textContent = question;
  _confirmCallback = onConfirm;
  document.getElementById('confirm-overlay').classList.add('open');
}

function closeConfirm(confirmed) {
  document.getElementById('confirm-overlay').classList.remove('open');
  if (confirmed && _confirmCallback) _confirmCallback();
  _confirmCallback = null;
}
