// ═══════════════════════════════════════════════════════
// GENERATOR.JS — CICS Trace Generator logic
// ═══════════════════════════════════════════════════════

let genLayoutFields  = [];
let genOccursGroups  = {};
let genFixedPartValue = '';
let genFixedPartField = null;

// ── Tab navigation ───────────────────────────────────────
function genSwitchTab(name) {
  const names = ['layout', 'form', 'trace'];
  document.querySelectorAll('#genTabs .tool-tab').forEach((t, i) =>
    t.classList.toggle('active', names[i] === name));
  ['gen-panel-layout', 'gen-panel-form', 'gen-panel-trace'].forEach((id, i) =>
    document.getElementById(id).classList.toggle('active', names[i] === name));
}

function genSwitchMiniTab(name) {
  const names = ['extract', 'manual'];
  document.querySelectorAll('#genFixedPartSection .mini-tab').forEach((t, i) =>
    t.classList.toggle('active', names[i] === name));
  ['gen-mini-extract', 'gen-mini-manual'].forEach((id, i) =>
    document.getElementById(id).classList.toggle('active', names[i] === name));
}

// ── Layout parsing ───────────────────────────────────────
function genParseExcel() {
  const raw = document.getElementById('genExcelPaste').value.trim();
  if (!raw) { genShowAlert('genParseAlert', 'warn', 'Pega el contenido de la tabla copiado primero.'); return; }

  const lines   = raw.split('\n').map(l => l.trimEnd());
  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());
  const colMap  = detectColumns(headers);
  if (colMap.campo < 0) { genShowAlert('genParseAlert', 'warn', 'No se detectó columna "Campo".'); return; }

  genLayoutFields = []; genOccursGroups = {}; genFixedPartField = null; genFixedPartValue = '';
  let currentOccurs = null;

  for (let i = 1; i < lines.length; i++) {
    const cells  = lines[i].split('\t');
    const campo  = getCellVal(cells, colMap.campo); if (!campo) continue;
    const largo  = parseInt(getCellVal(cells, colMap.largo)) || 0;
    const tipo   = cleanTipo(getCellVal(cells, colMap.tipo));
    const desc   = getCellVal(cells, colMap.desc);
    const oblig  = getCellVal(cells, colMap.oblig);
    const vals   = getCellVal(cells, colMap.vals);
    const occurs = getCellVal(cells, colMap.occurs);
    const max    = parseInt(getCellVal(cells, colMap.max)) || 0;

    const field = {
      campo: campo.trim(), largo, tipo, desc: desc.trim(),
      oblig: /^s[i]?/i.test(oblig.trim()), vals: vals.trim(),
      occurs: occurs.trim(), max,
      isOccursHeader: false, occursGroup: null,
      isFiller: /FILLER/i.test(campo), isFixedPart: false,
    };

    // OCCURS group header (no largo, no tipo)
    if (!largo && !tipo && (/OCC/i.test(campo) || occurs)) {
      currentOccurs = campo.trim();
      const occMax = max || parseInt(occurs) || 5;
      genOccursGroups[currentOccurs] = { fields: [], max: occMax };
      field.isOccursHeader = true; field.max = occMax;
      genLayoutFields.push(field); continue;
    }

    // Section separator
    if (!largo && !tipo && !occurs && !/OCC/i.test(campo)) {
      currentOccurs = null; genLayoutFields.push(field); continue;
    }

    // Detect indented OCCURS child
    const rawCell = lines[i].split('\t')[colMap.campo] || '';
    const indent  = rawCell.length - rawCell.trimStart().length;
    if (currentOccurs && indent >= 3) {
      field.occursGroup = currentOccurs;
      genOccursGroups[currentOccurs].fields.push(field);
    } else {
      if (!/OCC/i.test(campo)) currentOccurs = null;
    }

    // Detect fixed part (first wide alphanumeric top-level field)
    if (!genFixedPartField && tipo && tipo.startsWith('X') && largo >= 20 && !field.occursGroup && !field.isFiller) {
      field.isFixedPart = true;
      genFixedPartField = field;
    }

    genLayoutFields.push(field);
  }

  if (genLayoutFields.length === 0) { genShowAlert('genParseAlert', 'warn', 'No se encontraron campos.'); return; }

  genRenderLayoutTable();
  const fc = genLayoutFields.filter(f => !f.isOccursHeader && f.largo).length;
  const oc = Object.keys(genOccursGroups).length;
  let msg = `Layout interpretado: ${fc} campos, ${oc} grupos OCCURS.`;
  if (genFixedPartField) msg += ` Parte fija: ${genFixedPartField.campo} (${genFixedPartField.largo} chars).`;
  genShowAlert('genParseAlert', 'success', msg);
  document.getElementById('genLayoutActions').style.display = 'flex';
}

function genRenderLayoutTable() {
  let html = `<div class="field-table-wrap"><table class="field-table">
    <tr><th>CAMPO</th><th>LARGO</th><th>TIPO</th><th>DESCRIPCIÓN</th><th>OBLIG</th><th>VALORES</th><th>NOTAS</th></tr>`;

  for (const f of genLayoutFields) {
    if (f.isOccursHeader) {
      html += `<tr class="occurs-header"><td colspan="7">◈ OCCURS: ${f.campo} · MAX: ${f.max}</td></tr>`;
      continue;
    }
    if (!f.largo && !f.tipo) {
      html += `<tr><td colspan="7" style="color:var(--text3);font-size:10px;padding:8px 10px;background:var(--bg3)">── ${f.campo} ──</td></tr>`;
      continue;
    }
    const tc  = !f.tipo ? '' : f.tipo.startsWith('X') ? 'type-x' : f.tipo.includes('V') ? 'type-dec' : 'type-9';
    const nc  = f.occursGroup ? 'field-name occurs-child-name' : 'field-name';
    const rc  = f.occursGroup ? 'occurs-child' : f.isFiller ? 'filler-row' : '';
    const note = f.isFixedPart
      ? `<span style="color:var(--accent);display:flex;align-items:center;gap:4px"><svg style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:1.5"><use href="#icon-lock"></use></svg> PARTE FIJA</span>`
      : f.isFiller ? '<span style="color:var(--text3)">FILLER</span>'
      : f.occursGroup ? `<span style="color:#a78bfa">${f.occursGroup}</span>` : '';

    html += `<tr class="${rc}">
      <td><span class="${nc}" style="${f.isFixedPart ? 'color:var(--accent)' : ''}">${f.campo}</span></td>
      <td style="color:var(--yellow)">${f.largo || ''}</td>
      <td>${f.tipo ? `<span class="type-badge ${tc}">${f.tipo}</span>` : '—'}</td>
      <td style="color:var(--text2);font-size:11px">${f.desc}</td>
      <td><span class="req-dot ${f.oblig ? 'req-yes' : 'req-no'}"></span></td>
      <td style="color:var(--text3);font-size:10px">${f.vals || ''}</td>
      <td style="font-size:9px">${note}</td>
    </tr>`;
  }

  html += '</table></div>';
  document.getElementById('genLayoutTableWrap').innerHTML = html;
}

// ── Form builder ─────────────────────────────────────────
function genBuildForm() {
  if (genLayoutFields.length === 0) return;

  // Fixed part section
  const fixedSection = document.getElementById('genFixedPartSection');
  if (genFixedPartField) {
    fixedSection.style.display = 'block';
    document.getElementById('genFixedFieldName').textContent = genFixedPartField.campo;
    document.getElementById('genFixedFieldDesc').textContent = genFixedPartField.desc || 'Campo de parte fija / header';
    document.getElementById('genFixedLargoLabel').textContent = genFixedPartField.largo + ' chars';
    document.getElementById('genFixedLenHint').textContent   = genFixedPartField.largo;
    document.getElementById('genFixedLenHint2').textContent  = genFixedPartField.largo;
    document.getElementById('genFixedManualInput').maxLength = genFixedPartField.largo;
    document.getElementById('genFixedManualCounter').textContent = '0/' + genFixedPartField.largo;
    genUpdateFixedUI();
  } else {
    fixedSection.style.display = 'none';
  }

  // Build editable sections
  const sections = [];
  let sec = { name: 'DATOS', fields: [] };

  for (const f of genLayoutFields) {
    if (f.isFixedPart || f.isFiller) continue;
    if (f.isOccursHeader) {
      if (sec.fields.length > 0) { sections.push(sec); sec = { name: 'DATOS', fields: [] }; }
      sections.push({ isOccurs: true, occursName: f.campo, max: f.max, fields: genOccursGroups[f.campo]?.fields || [] });
      continue;
    }
    if (!f.largo && !f.tipo && !f.occursGroup) {
      if (sec.fields.length > 0) sections.push(sec);
      sec = { name: f.campo, fields: [] };
      continue;
    }
    if (!f.occursGroup) sec.fields.push(f);
  }
  if (sec.fields.length > 0) sections.push(sec);

  let html = '';
  for (const section of sections) {
    if (section.isOccurs) { html += genRenderOccursBlock(section.occursName, section.fields, section.max); continue; }
    if (section.fields.length === 0) continue;
    html += `<div class="form-section">
      <div class="form-section-header">
        <svg class="icon" style="stroke:currentColor;fill:none;stroke-width:1.5"><use href="#icon-form"></use></svg>
        ${section.name}
      </div>
      <div class="form-section-body">
        <div class="form-grid">${section.fields.map(f => genRenderFieldInput(f, '')).join('')}</div>
      </div>
    </div>`;
  }

  document.getElementById('genFormContent').innerHTML = html ||
    '<div class="alert alert-warn"><svg class="icon"><use href="#icon-warning"></use></svg> No se encontraron campos editables.</div>';
  document.getElementById('genFormActions').style.display = 'block';
}

function genRenderFieldInput(f, suffix) {
  const fieldId  = 'field_' + sanitizeId(f.campo + (suffix || ''));
  const valList  = parseValues(f.vals);
  const maxLen   = f.largo || 100;
  const safeKey  = sanitizeId(f.campo + (suffix || ''));
  const tc = !f.tipo ? 'type-x' : f.tipo.startsWith('X') ? 'type-x' : f.tipo.includes('V') ? 'type-dec' : 'type-9';

  const inputHtml = valList.length >= 2
    ? `<select class="form-input" id="${fieldId}" data-field="${f.campo}">
        <option value="">-- Seleccionar --</option>
        ${valList.map(v => `<option value="${v}">${v}</option>`).join('')}
       </select>`
    : `<div class="input-wrap">
        <input class="form-input" type="text" id="${fieldId}" data-field="${f.campo}"
          maxlength="${maxLen}" placeholder="${getPlaceholder(f)}"
          oninput="genUpdateCharCount(this,${maxLen},'${safeKey}')">
        <span class="char-counter" id="cc_${safeKey}">0/${maxLen}</span>
       </div>`;

  return `<div class="field-group">
    <div class="field-label">${f.campo}${f.oblig ? ' <span style="color:var(--red)">*</span>' : ''}</div>
    <div class="field-hint">${f.desc || ''} · <span style="color:var(--yellow)">${f.largo}</span> · <span class="type-badge ${tc}" style="font-size:8px">${f.tipo || 'X'}</span></div>
    ${inputHtml}
  </div>`;
}

function genRenderOccursBlock(name, fields, max) {
  const safeId = sanitizeId(name);
  if (genOccursGroups[name]) genOccursGroups[name].safeId = safeId;
  return `<div class="occurs-block" id="ob_${safeId}">
    <div class="occurs-block-header">
      <span class="occurs-block-title">◈ OCCURS: ${name} · MAX: ${max}</span>
      <div style="display:flex;gap:8px;align-items:center">
        <span style="font-size:10px;color:#a78bfa" id="ob_count_${safeId}">0 / ${max}</span>
        <button class="btn btn-secondary" style="font-size:10px;padding:4px 10px"
          onclick="genAddOccursInstance('${safeId}','${name}',${max})">
          <svg class="icon icon-sm"><use href="#icon-add"></use></svg>AGREGAR
        </button>
      </div>
    </div>
    <div id="ob_alert_${safeId}" style="display:none;margin:6px 14px 0"></div>
    <div id="ob_instances_${safeId}"></div>
  </div>`;
}

function genAddOccursInstance(safeId, name, max) {
  const wrap    = document.getElementById('ob_instances_' + safeId);
  const current = wrap.querySelectorAll('.occurs-instance').length;
  if (current >= max) { genShowAlert('ob_alert_' + safeId, 'warn', `Máximo de ${max} registros alcanzado.`); return; }
  const idx = current + 1;
  const og  = genOccursGroups[name]; if (!og) return;

  const div = document.createElement('div');
  div.className = 'occurs-instance';
  div.id = `oi_${safeId}_${idx}`;
  div.innerHTML = `<div class="occurs-instance-header">
    <span>REGISTRO #${idx}</span>
    <button class="btn btn-danger" onclick="genRemoveOccursInstance('${safeId}','${name}',${idx})">
      <svg class="icon icon-sm"><use href="#icon-remove"></use></svg>ELIMINAR
    </button>
  </div>
  <div class="occurs-fields">${og.fields.map(f => genRenderFieldInput(f, '_OCC' + idx)).join('')}</div>`;
  wrap.appendChild(div);
  document.getElementById('ob_count_' + safeId).textContent = idx + ' / ' + max;
}

function genRemoveOccursInstance(safeId, name, idx) {
  const el = document.getElementById('oi_' + safeId + '_' + idx);
  if (el) el.remove();
  const count = document.getElementById('ob_instances_' + safeId).querySelectorAll('.occurs-instance').length;
  document.getElementById('ob_count_' + safeId).textContent = count + ' / ' + (genOccursGroups[name]?.max || '?');
}

function genUpdateCharCount(el, max, safeKey) {
  const cc  = document.getElementById('cc_' + safeKey); if (!cc) return;
  const len = el.value.length;
  cc.textContent = len + '/' + max;
  cc.style.color = len >= max ? 'var(--red)' : len >= max * 0.85 ? 'var(--yellow)' : 'var(--text3)';
}

// ── Fixed part ───────────────────────────────────────────
function genExtractFixedFromTrace() {
  const trace = document.getElementById('genExampleTracePaste').value;
  if (!genFixedPartField || !trace) { genShowAlert('genFixedExtractAlert', 'warn', 'Pega una traza de ejemplo primero.'); return; }
  if (trace.length < genFixedPartField.largo) {
    genShowAlert('genFixedExtractAlert', 'warn', `La traza tiene ${trace.length} chars pero se requieren ${genFixedPartField.largo}.`);
    return;
  }
  genFixedPartValue = trace.substring(0, genFixedPartField.largo);
  genUpdateFixedUI();
  genShowAlert('genFixedExtractAlert', 'success', `Parte fija extraída: ${genFixedPartField.largo} chars.`);
}

function genApplyManualFixed() {
  if (!genFixedPartField) return;
  const val = document.getElementById('genFixedManualInput').value;
  if (val.length !== genFixedPartField.largo) {
    genShowAlert('genFixedManualAlert', 'warn', `Debe tener ${genFixedPartField.largo} caracteres (tienes ${val.length}).`);
    return;
  }
  genFixedPartValue = val;
  genUpdateFixedUI();
  genShowAlert('genFixedManualAlert', 'success', `Parte fija definida: ${genFixedPartField.largo} chars.`);
}

function genUpdateFixedManual() {
  const val = document.getElementById('genFixedManualInput').value;
  const max = genFixedPartField ? genFixedPartField.largo : 0;
  const cc  = document.getElementById('genFixedManualCounter');
  if (cc) cc.textContent = val.length + '/' + max;
}

function genClearFixed() {
  genFixedPartValue = '';
  const t = document.getElementById('genExampleTracePaste'); if (t) t.value = '';
  const m = document.getElementById('genFixedManualInput');  if (m) m.value = '';
  genUpdateFixedUI();
}

function genUpdateFixedUI() {
  const pill    = document.getElementById('genFixedStatusPill');
  const wrap    = document.getElementById('genFixedValueWrap');
  const display = document.getElementById('genFixedValueDisplay');
  if (!pill) return;
  if (genFixedPartValue) {
    pill.className   = 'fixed-status-pill fixed-pill-ok';
    pill.textContent = '✓ DEFINIDA · ' + genFixedPartValue.length + ' CHARS';
    if (wrap) wrap.style.display = 'block';
    if (display) display.textContent = genFixedPartValue;
  } else {
    pill.className   = 'fixed-status-pill fixed-pill-empty';
    pill.textContent = 'SIN DEFINIR';
    if (wrap) wrap.style.display = 'none';
  }
}

// ── Trace generation ─────────────────────────────────────
function genGenerateTrace() {
  const errors   = [];
  let trace      = '';
  const segments = [];

  // Clear previous highlights
  document.querySelectorAll('.form-input.field-required-empty').forEach(el => el.classList.remove('field-required-empty'));

  // Top-level fields
  for (const f of genLayoutFields) {
    if (f.isOccursHeader || !f.largo) continue;
    if (f.isFixedPart) {
      const val = (genFixedPartValue || ' '.repeat(f.largo)).substring(0, f.largo).padEnd(f.largo, ' ');
      trace += val;
      segments.push({ val, type: 'fixed', name: f.campo });
      continue;
    }
    if (f.isFiller) {
      const fill = f.tipo && f.tipo.startsWith('9') ? '0'.repeat(f.largo) : ' '.repeat(f.largo);
      trace += fill;
      segments.push({ val: fill, type: 'f' });
      continue;
    }
    if (f.occursGroup) continue;

    const el  = document.getElementById('field_' + sanitizeId(f.campo));
    let   val = el ? el.value : '';
    if (f.oblig && !val.trim()) {
      errors.push(`Campo obligatorio vacío: ${f.campo}`);
      if (el) el.classList.add('field-required-empty');
    }
    const formatted = formatField(f, val);
    trace += formatted;
    segments.push({ val: formatted, type: f.tipo && f.tipo.startsWith('X') ? 'a' : '9', name: f.campo });
  }

  // OCCURS groups
  for (const [name, og] of Object.entries(genOccursGroups)) {
    const safeId = og.safeId; if (!safeId) continue;
    const wrap   = document.getElementById('ob_instances_' + safeId); if (!wrap) continue;
    const instances = wrap.querySelectorAll('.occurs-instance');
    let occStr = '';

    instances.forEach((_, idx) => {
      const n = idx + 1;
      for (const f of og.fields) {
        const el  = document.getElementById('field_' + sanitizeId(f.campo + '_OCC' + n));
        let   val = el ? el.value : '';
        if (f.oblig && !val.trim()) {
          errors.push(`OCCURS ${name} [#${n}] · ${f.campo}: obligatorio`);
          if (el) el.classList.add('field-required-empty');
        }
        occStr += formatField(f, val);
      }
    });

    const instSize = og.fields.reduce((s, f) => s + (f.largo || 0), 0);
    occStr += ' '.repeat((og.max - instances.length) * instSize);
    trace += occStr;
    segments.push({ val: occStr, type: 'o', name });
  }

  // Show errors
  const errDisplay = document.getElementById('genErrorsDisplay');
  if (errors.length > 0) {
    errDisplay.style.display = 'block';
    errDisplay.innerHTML = `<div class="errors-list">${errors.map(e => `<div class="error-item">${e}</div>`).join('')}</div>`;
    showConfirm(
      'CAMPOS OBLIGATORIOS VACÍOS',
      `Se encontraron <strong style="color:var(--red)">${errors.length}</strong> campo(s) obligatorio(s) sin completar:`,
      errors,
      '¿Desea generar la traza de todas formas con espacios en esos campos?',
      () => { if (trace) { window._lastGenTrace = trace; genSwitchTab('trace'); genRenderTrace(trace, segments); } }
    );
    return;
  }
  errDisplay.style.display = 'none';
  if (trace) { window._lastGenTrace = trace; genSwitchTab('trace'); genRenderTrace(trace, segments); }
}

function genRenderTrace(trace, segments) {
  const tc  = document.getElementById('genTraceContent');
  const now = new Date().toLocaleString('es-CL');
  let colored = '';

  for (const s of segments) {
    const cls = s.type === 'fixed' ? 'trace-seg-fixed'
      : s.type === 'a' ? 'trace-seg-a'
      : s.type === '9' ? 'trace-seg-9'
      : s.type === 'o' ? 'trace-seg-o'
      : 'trace-seg-f';
    colored += `<span class="${cls}" title="${s.name || 'FILLER'}">${escHtml(s.val)}</span>`;
  }

  tc.innerHTML = `
    <div class="alert alert-success"><svg class="icon"><use href="#icon-success"></use></svg> Traza generada · ${trace.length} caracteres · ${now}</div>
    <div class="section-title">TRAZA COMPLETA (RAW)</div>
    <div class="trace-output">${escHtml(trace)}</div>
    <div class="trace-meta">
      <span class="trace-stat">LONGITUD: <strong>${trace.length}</strong></span>
      <span class="trace-stat">CAMPOS: <strong>${genLayoutFields.filter(f => !f.isOccursHeader && f.largo).length}</strong></span>
      ${genFixedPartValue ? `<span class="trace-stat">PARTE FIJA: <strong style="color:var(--accent)">${genFixedPartField.largo} CHARS</strong></span>` : ''}
    </div>
    <div class="btn-row" style="margin-top:14px">
      <button class="btn btn-primary" onclick="navigator.clipboard.writeText(window._lastGenTrace).then(()=>genShowAlert('genCopyAlert','success','✓ Traza copiada al portapapeles.'))">
        <svg class="icon"><use href="#icon-copy"></use></svg>COPIAR
      </button>
      <button class="btn btn-orange" onclick="genDownloadTrace()">
        <svg class="icon"><use href="#icon-download"></use></svg>DESCARGAR TXT
      </button>
      <button class="btn btn-secondary" onclick="genSwitchTab('form')">
        <svg class="icon"><use href="#icon-back"></use></svg>VOLVER
      </button>
    </div>
    <div id="genCopyAlert" style="display:none"></div>
    <div class="sep"></div>
    <div class="section-title">VISUALIZACIÓN COLOREADA</div>
    <div class="alert alert-info" style="font-size:9px">
      <span style="color:var(--accent)">■</span> Parte Fija &nbsp;
      <span style="color:#7dd3fc">■</span> Alfanumérico &nbsp;
      <span style="color:#fde047">■</span> Numérico &nbsp;
      <span style="color:#c4b5fd">■</span> OCCURS &nbsp;
      <span style="color:var(--text3)">■</span> FILLER
    </div>
    <div class="trace-output" style="font-size:11px;line-height:2">${colored}</div>
    <div class="sep"></div>
    <div class="section-title">DESGLOSE POR CAMPO</div>
    <div class="field-table-wrap"><table class="field-table">
      <tr><th>#</th><th>CAMPO</th><th>POSICIÓN</th><th>LARGO</th><th>VALOR</th></tr>
      ${genBuildFieldBreakdown(trace)}
    </table></div>`;
}

function genBuildFieldBreakdown(trace) {
  let pos = 1, rows = '', idx = 0;
  for (const f of genLayoutFields) {
    if (f.isOccursHeader || !f.largo || f.occursGroup) continue;
    idx++;
    const seg = trace.substring(pos - 1, pos - 1 + f.largo);
    const cls = f.isFixedPart ? 'trace-seg-fixed' : f.tipo && f.tipo.startsWith('X') ? 'trace-seg-a' : 'trace-seg-9';
    rows += `<tr>
      <td style="color:var(--text3)">${idx}</td>
      <td class="field-name" style="${f.isFixedPart ? 'color:var(--accent)' : ''}">${f.isFiller ? '<span style="color:var(--text3)">FILLER</span>' : f.campo}</td>
      <td style="color:var(--text2)">${pos} – ${pos + f.largo - 1}</td>
      <td style="color:var(--yellow)">${f.largo}</td>
      <td><code class="${cls}" style="background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:3px;font-size:11px">${escHtml(seg)}</code></td>
    </tr>`;
    pos += f.largo;
  }
  return rows;
}

// ── Save / Load .cicsform ────────────────────────────────
function genSaveFormFile() {
  const formValues = {};
  document.querySelectorAll('.form-input[data-field]').forEach(el => { if (el.id) formValues[el.id] = el.value; });

  const occursInstances = {};
  for (const [name, og] of Object.entries(genOccursGroups)) {
    if (!og.safeId) continue;
    const wrap = document.getElementById('ob_instances_' + og.safeId);
    if (wrap) occursInstances[name] = wrap.querySelectorAll('.occurs-instance').length;
  }

  const data = {
    version: '2.1', type: 'cicsform', date: new Date().toISOString(),
    layoutFields: genLayoutFields,
    occursGroups: Object.fromEntries(Object.entries(genOccursGroups).map(([k, v]) => [k, { fields: v.fields, max: v.max }])),
    fixedPartValue: genFixedPartValue, formValues, occursInstances,
  };
  const a    = document.createElement('a');
  a.download = `formulario_cics_${new Date().toISOString().substring(0, 10)}.cicsform`;
  a.href     = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
  a.click();
}

function genLoadFormFile(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.type !== 'cicsform') throw new Error('Archivo no es un .cicsform válido.');

      genLayoutFields  = data.layoutFields || [];
      genOccursGroups  = {};
      for (const [k, v] of Object.entries(data.occursGroups || {}))
        genOccursGroups[k] = { fields: v.fields || [], max: v.max, safeId: sanitizeId(k) };
      genFixedPartValue = data.fixedPartValue || '';
      genFixedPartField = genLayoutFields.find(f => f.isFixedPart) || null;

      genRenderLayoutTable();
      document.getElementById('genLayoutActions').style.display = 'flex';
      genShowAlert('genParseAlert', 'success', `✓ Formulario cargado: ${genLayoutFields.filter(f => !f.isOccursHeader && f.largo).length} campos.`);
      genSwitchTab('form');
      genBuildForm();

      setTimeout(() => {
        const vals      = data.formValues     || {};
        const instances = data.occursInstances || {};
        for (const [name, count] of Object.entries(instances)) {
          const og = genOccursGroups[name];
          if (!og || !og.safeId) continue;
          for (let i = 0; i < count; i++) genAddOccursInstance(og.safeId, name, og.max);
        }
        setTimeout(() => {
          for (const [id, val] of Object.entries(vals)) {
            const el = document.getElementById(id);
            if (el) el.value = val;
          }
        }, 80);
      }, 80);
    } catch (err) {
      genShowAlert('genParseAlert', 'warn', 'Error al cargar: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function genDownloadTrace() {
  if (!window._lastGenTrace) return;
  const a    = document.createElement('a');
  a.download = `traza_cics_${new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)}.txt`;
  a.href     = 'data:text/plain;charset=utf-8,' + encodeURIComponent(window._lastGenTrace);
  a.click();
}

function genClearLayout() {
  genLayoutFields = []; genOccursGroups = {}; genFixedPartField = null; genFixedPartValue = '';
  document.getElementById('genExcelPaste').value = '';
  document.getElementById('genLayoutTableWrap').innerHTML =
    '<div class="alert alert-info"><svg class="icon"><use href="#icon-info"></use></svg> Pega el layout copiado desde una tabla.</div>';
  document.getElementById('genLayoutActions').style.display = 'none';
  document.getElementById('genParseAlert').style.display   = 'none';
}

function genResetForm() {
  document.querySelectorAll('.form-input').forEach(el => { el.value = ''; });
  document.querySelectorAll('.occurs-instance').forEach(el => el.remove());
  for (const [name, og] of Object.entries(genOccursGroups)) {
    if (og.safeId) {
      const el = document.getElementById('ob_count_' + og.safeId);
      if (el) el.textContent = '0 / ' + og.max;
    }
  }
  document.getElementById('genErrorsDisplay').style.display = 'none';
  genClearFixed();
}

// ── Alerts ───────────────────────────────────────────────
function genShowAlert(id, type, msg) {
  const el = document.getElementById(id); if (!el) return;
  el.style.display = 'block';
  el.className     = 'alert alert-' + type;
  const icon = type === 'success' ? 'success' : type === 'warn' ? 'warning' : 'info';
  el.innerHTML = `<svg class="icon"><use href="#icon-${icon}"></use></svg> ${msg}`;
}

// ── Sample data ──────────────────────────────────────────
function genLoadSampleData() {
  const sample = `Campo\tLargo\tTipo\tDescripción\tOblig\tValores\nTX-HEADER-FIXED\t25\tX(25)\tHeader transaccional fijo\t\t\nDATOS-RESERVA\t\t\t\t\t\nRV-COD-TRX\t4\tX(04)\tCódigo transacción\tSI\t'RESV','CANC','MODI'\nRV-NUM-RESERVA\t10\tX(010)\tNúmero de reserva\tSI\t\nRV-FEC-ENTRADA\t8\t9(008)\tFecha entrada\tSI\t\nRV-FEC-SALIDA\t8\t9(008)\tFecha salida\tSI\t\nRV-COD-HOTEL\t6\tX(006)\tCódigo hotel\tSI\t\nRV-TIP-HAB\t3\tX(003)\tTipo habitación\tSI\t'SGL','DBL','STE'\nRV-CAN-NOC\t3\t9(003)\tCantidad de noches\tSI\t\nRV-TRF-NOC\t12\t9(007)V9(005)\tTarifa por noche\tSI\t\nRV-MTO-TOTAL\t15\t9(009)V9(006)\tMonto total\tSI\t\nRV-COD-MON\t3\tX(003)\tMoneda\tSI\t'CLP','USD','EUR'\nRV-IND-DES\t1\t9(001)\tIncluye desayuno\tSI\t0,1\nRV-COD-CNL\t3\tX(003)\tCanal de venta\tSI\t'WEB','APP','AGN'`;
  document.getElementById('genExcelPaste').value = sample;
  genParseExcel();
}
