// ═══════════════════════════════════════════════════════
// VALIDATOR.JS — CICS Response Validator logic
// ═══════════════════════════════════════════════════════

let valLayoutFields = [];
let valOccursGroups = {};
let valLastResult   = null;

// ── Tab navigation ───────────────────────────────────────
function valSwitchTab(name) {
  const names = ['layout', 'parse', 'result'];
  document.querySelectorAll('#valTabs .tool-tab').forEach((t, i) =>
    t.classList.toggle('active', names[i] === name));
  ['val-panel-layout', 'val-panel-parse', 'val-panel-result'].forEach((id, i) =>
    document.getElementById(id).classList.toggle('active', names[i] === name));
  if (name === 'parse') valRefreshLayoutSummary();
}

// ── Layout parsing ───────────────────────────────────────
function valParseLayout() {
  const raw = document.getElementById('valExcelPaste').value.trim();
  if (!raw) { valShowAlert('valLayoutAlert', 'warn', 'Pega el contenido de la tabla primero.'); return; }

  const lines   = raw.split('\n').map(l => l.trimEnd());
  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());
  const colMap  = detectColumns(headers);
  if (colMap.campo < 0) { valShowAlert('valLayoutAlert', 'warn', 'No se detectó columna "Campo".'); return; }

  valLayoutFields = []; valOccursGroups = {};
  let currentOccurs = null;

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split('\t');
    const campo = getCellVal(cells, colMap.campo); if (!campo) continue;
    const largo = parseInt(getCellVal(cells, colMap.largo)) || 0;
    const tipo  = cleanTipo(getCellVal(cells, colMap.tipo));
    const desc  = getCellVal(cells, colMap.desc);
    const oblig = getCellVal(cells, colMap.oblig);
    const vals  = getCellVal(cells, colMap.vals);
    const max   = parseInt(getCellVal(cells, colMap.max)) || 0;

    const field = {
      campo: campo.trim(), largo, tipo, desc: desc.trim(),
      oblig: /^s[i]?/i.test(oblig.trim()), vals: vals.trim(), max,
      isOccursHeader: false, occursGroup: null,
      isFiller: /FILLER/i.test(campo),
    };

    if (!largo && !tipo && /OCC/i.test(campo)) {
      currentOccurs = campo.trim();
      const occMax  = max || 5;
      valOccursGroups[currentOccurs] = { fields: [], max: occMax };
      field.isOccursHeader = true; field.max = occMax;
      valLayoutFields.push(field); continue;
    }

    if (!largo && !tipo && !/OCC/i.test(campo)) {
      currentOccurs = null; valLayoutFields.push(field); continue;
    }

    const rawCell = lines[i].split('\t')[colMap.campo] || '';
    const indent  = rawCell.length - rawCell.trimStart().length;
    if (currentOccurs && indent >= 3) {
      field.occursGroup = currentOccurs;
      valOccursGroups[currentOccurs].fields.push(field);
    } else {
      if (!/OCC/i.test(campo)) currentOccurs = null;
    }

    valLayoutFields.push(field);
  }

  if (valLayoutFields.length === 0) { valShowAlert('valLayoutAlert', 'warn', 'No se encontraron campos.'); return; }

  valRenderLayoutTable();
  const fc  = valLayoutFields.filter(f => !f.isOccursHeader && f.largo).length;
  const oc  = Object.keys(valOccursGroups).length;
  const exp = valCalcExpectedLength();
  valShowAlert('valLayoutAlert', 'success',
    `Layout interpretado: ${fc} campos, ${oc} grupos OCCURS. Longitud esperada: ${exp} chars.`);
  document.getElementById('valLayoutActions').style.display = 'block';
}

function valCalcExpectedLength() {
  let len = 0;
  for (const f of valLayoutFields) {
    if (f.isOccursHeader || !f.largo || f.occursGroup) continue;
    len += f.largo;
  }
  for (const [, og] of Object.entries(valOccursGroups)) {
    const instSize = og.fields.reduce((s, f) => s + (f.largo || 0), 0);
    len += instSize * og.max;
  }
  return len;
}

function valRenderLayoutTable() {
  let html = `<div class="field-table-wrap"><table class="field-table">
    <tr><th>CAMPO</th><th>POS</th><th>LARGO</th><th>TIPO</th><th>DESCRIPCIÓN</th><th>OBLIG</th><th>VALORES</th></tr>`;
  let pos = 1;

  for (const f of valLayoutFields) {
    if (f.isOccursHeader) {
      html += `<tr class="occurs-header"><td colspan="7">◈ OCCURS: ${f.campo} · MAX: ${f.max}</td></tr>`;
      continue;
    }
    if (!f.largo && !f.tipo) {
      html += `<tr><td colspan="7" style="color:var(--text3);font-size:10px;padding:6px 10px;background:var(--bg3)">── ${f.campo} ──</td></tr>`;
      continue;
    }
    const tc     = !f.tipo ? '' : f.tipo.startsWith('X') ? 'type-x' : f.tipo.includes('V') ? 'type-dec' : 'type-9';
    const nc     = f.occursGroup ? 'field-name occurs-child-name' : 'field-name';
    const rc     = f.occursGroup ? 'occurs-child' : f.isFiller ? 'filler-row' : '';
    const posStr = f.occursGroup ? '—' : pos;
    if (!f.occursGroup && f.largo) pos += f.largo;

    html += `<tr class="${rc}">
      <td><span class="${nc}">${f.campo}</span></td>
      <td style="color:var(--text3);font-size:10px">${posStr}</td>
      <td style="color:var(--yellow)">${f.largo || ''}</td>
      <td>${f.tipo ? `<span class="type-badge ${tc}">${f.tipo}</span>` : '—'}</td>
      <td style="color:var(--text2);font-size:10px">${f.desc}</td>
      <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${f.oblig ? 'var(--red)' : 'var(--text3)'}"></span></td>
      <td style="color:var(--text3);font-size:10px">${f.vals || ''}</td>
    </tr>`;
  }
  html += '</table></div>';
  document.getElementById('valLayoutTableWrap').innerHTML = html;
}

function valLoadCicsForm(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.type !== 'cicsform') throw new Error('No es un .cicsform válido.');
      valLayoutFields = data.layoutFields || [];
      valOccursGroups = {};
      for (const [k, v] of Object.entries(data.occursGroups || {}))
        valOccursGroups[k] = { fields: v.fields || [], max: v.max };
      valRenderLayoutTable();
      document.getElementById('valLayoutActions').style.display = 'block';
      const fc = valLayoutFields.filter(f => !f.isOccursHeader && f.largo).length;
      valShowAlert('valLayoutAlert', 'success',
        `✓ Cargado desde .cicsform: ${fc} campos. Longitud esperada: ${valCalcExpectedLength()} chars.`);
    } catch (err) {
      valShowAlert('valLayoutAlert', 'warn', 'Error: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function valRefreshLayoutSummary() {
  const el = document.getElementById('valLayoutSummary');
  if (valLayoutFields.length === 0) {
    el.innerHTML = `<div class="alert alert-warn"><svg class="icon"><use href="#icon-warning"></use></svg> No hay layout cargado.</div>`;
    return;
  }
  const fc  = valLayoutFields.filter(f => !f.isOccursHeader && f.largo).length;
  const exp = valCalcExpectedLength();
  el.innerHTML = `<div class="alert alert-success" style="margin-bottom:0">
    <svg class="icon"><use href="#icon-success"></use></svg>
    Layout activo: <strong>${fc} campos</strong> · Longitud esperada: <strong>${exp} chars</strong>
  </div>`;
}

// ── Live trace length counter ────────────────────────────
function valInitTraceCounter() {
  document.getElementById('valTraceInput').addEventListener('input', function () {
    const len  = this.value.trim().length;
    const exp  = valCalcExpectedLength();
    const wrap = document.getElementById('valTraceLenInfo');
    const txt  = document.getElementById('valTraceLenText');
    const alrt = document.getElementById('valTraceLenAlert');
    if (!this.value.trim()) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    if (exp === 0)         { alrt.className = 'alert alert-info';    txt.textContent = `Longitud: ${len} chars.`; }
    else if (len === exp)  { alrt.className = 'alert alert-success'; txt.innerHTML = `Longitud correcta: ${len} chars.`; }
    else if (len < exp)    { alrt.className = 'alert alert-warn';    txt.innerHTML = `Traza corta: ${len} chars (esperado ${exp}, faltan ${exp - len}).`; }
    else                   { alrt.className = 'alert alert-warn';    txt.innerHTML = `Traza larga: ${len} chars (esperado ${exp}, excede ${len - exp}).`; }
  });
}

// ── Validation ───────────────────────────────────────────
function valRunValidation() {
  if (valLayoutFields.length === 0) { valShowAlert('valParseAlert', 'warn', 'Carga el layout primero.'); return; }
  const trace = document.getElementById('valTraceInput').value;
  if (!trace.trim()) { valShowAlert('valParseAlert', 'warn', 'Pega una traza de respuesta primero.'); return; }

  const opts = {
    oblig:   document.getElementById('valOptOblig').checked,
    vals:    document.getElementById('valOptVals').checked,
    numeric: document.getElementById('valOptNumeric').checked,
    length:  document.getElementById('valOptLength').checked,
  };

  const parsedFields = [], issues = [];
  let pos = 0;

  function processField(f, traceStr, posRef, instanceLabel) {
    if (!f.largo) return posRef;
    const raw  = traceStr.substring(posRef, posRef + f.largo);
    const name = instanceLabel ? `${f.campo} ${instanceLabel}` : f.campo;
    const fieldResult = {
      campo: name, baseCampo: f.campo, largo: f.largo, tipo: f.tipo,
      desc: f.desc, oblig: f.oblig, vals: f.vals,
      isFiller: f.isFiller, isOccursChild: !!instanceLabel, occursGroup: f.occursGroup,
      pos: posRef + 1, posEnd: posRef + f.largo, raw, val: raw, trimmed: raw.trim(),
      status: 'OK', messages: [],
    };

    if (!f.isFiller) {
      if (raw.length < f.largo) {
        fieldResult.status = 'ERROR';
        fieldResult.messages.push(`Traza truncada: esperados ${f.largo} chars, hay ${raw.length}.`);
        issues.push({ level: 'ERROR', field: name, msg: `Traza truncada en ${name}.` });
      } else {
        if (opts.oblig && f.oblig && !raw.trim()) {
          fieldResult.status = 'ERROR';
          fieldResult.messages.push('Campo obligatorio vacío.');
          issues.push({ level: 'ERROR', field: name, msg: `Obligatorio vacío: ${name}.` });
        }
        if (opts.numeric && f.tipo && (f.tipo.startsWith('9') || f.tipo.includes('V'))) {
          if (!/^\d+$/.test(raw.replace(/\s/g, ''))) {
            if (fieldResult.status === 'OK') fieldResult.status = 'WARN';
            fieldResult.messages.push(`No numérico: "${raw.trim()}".`);
            issues.push({ level: 'WARN', field: name, msg: `${name}: no numérico "${raw.trim()}".` });
          }
        }
        if (opts.vals && f.vals) {
          const allowed = parseValues(f.vals);
          if (allowed.length >= 2 && !allowed.includes(raw.trim()) && raw.trim() !== '') {
            if (fieldResult.status === 'OK') fieldResult.status = 'WARN';
            fieldResult.messages.push(`"${raw.trim()}" no está en [${allowed.join(', ')}].`);
            issues.push({ level: 'WARN', field: name, msg: `${name}: "${raw.trim()}" fuera de lista.` });
          }
        }
      }
    }

    parsedFields.push(fieldResult);
    return posRef + f.largo;
  }

  for (const f of valLayoutFields) {
    if (f.isOccursHeader) {
      const og = valOccursGroups[f.campo]; if (!og) continue;
      for (let i = 1; i <= og.max; i++) {
        parsedFields.push({ isOccursInstanceHeader: true, label: `${f.campo} · INSTANCIA #${i}` });
        for (const ff of og.fields) pos = processField(ff, trace, pos, `[#${i}]`);
      }
      continue;
    }
    if (!f.largo || f.occursGroup) continue;
    pos = processField(f, trace, pos, null);
  }

  const expected = valCalcExpectedLength();
  if (opts.length && expected > 0 && trace.length !== expected) {
    const dir = trace.length < expected ? 'corta' : 'larga';
    issues.push({ level: 'WARN', field: 'LONGITUD', msg: `Traza ${dir} en ${Math.abs(trace.length - expected)} chars (recibida: ${trace.length}, esperada: ${expected}).` });
  }

  const totalFields = parsedFields.filter(r => !r.isOccursInstanceHeader && !r.isFiller).length;
  const errCount    = parsedFields.filter(r => r.status === 'ERROR').length;
  const warnCount   = parsedFields.filter(r => r.status === 'WARN').length;
  const okCount     = totalFields - errCount - warnCount;

  valLastResult = { parsedFields, issues, trace, expected, totalFields, errCount, warnCount, okCount, ts: new Date().toISOString() };
  valSwitchTab('result');
  valRenderResult(valLastResult);
  valShowAlert('valParseAlert',
    errCount > 0 ? 'error' : warnCount > 0 ? 'warn' : 'success',
    errCount > 0 ? `Validación con ${errCount} error(es) y ${warnCount} advertencia(s).`
    : warnCount > 0 ? `Validación con ${warnCount} advertencia(s).`
    : 'Validación sin errores.');
}

// ── Result rendering ─────────────────────────────────────
function valRenderResult(r) {
  const { parsedFields, issues, trace, expected, totalFields, errCount, warnCount, okCount } = r;
  const now = new Date().toLocaleString('es-CL');

  let colored = '';
  for (const pf of parsedFields) {
    if (pf.isOccursInstanceHeader || !pf.raw) continue;
    const cls = pf.isFiller ? 'seg-fill'
      : pf.isOccursChild ? (pf.status === 'OK' ? 'seg-occurs' : pf.status === 'WARN' ? 'seg-warn' : 'seg-err')
      : pf.status === 'ERROR' ? 'seg-err'
      : pf.status === 'WARN'  ? 'seg-warn'
      : 'seg-ok';
    colored += `<span class="${cls}" title="${escHtml(pf.campo)}${pf.messages.length ? ' · ' + pf.messages[0] : ''}">${escHtml(pf.raw)}</span>`;
  }

  let tableRows = '';
  for (const pf of parsedFields) {
    if (pf.isOccursInstanceHeader) {
      tableRows += `<tr class="row-occurs"><td colspan="7">◈ ${escHtml(pf.label)}</td></tr>`;
      continue;
    }
    if (!pf.raw && pf.raw !== '') continue;

    const rowClass = pf.isFiller ? 'row-filler' : pf.status === 'ERROR' ? 'row-err' : pf.status === 'WARN' ? 'row-warn' : 'row-ok';
    const valClass = pf.status === 'ERROR' ? 'err' : pf.status === 'WARN' ? 'warn' : 'ok';
    const badge    = pf.isFiller
      ? `<span class="status-badge status-info">FILLER</span>`
      : pf.status === 'ERROR' ? `<span class="status-badge status-err">✕ ERROR</span>`
      : pf.status === 'WARN'  ? `<span class="status-badge status-warn">⚠ ADVERTENCIA</span>`
      : `<span class="status-badge status-ok">✓ OK</span>`;
    const msgHtml = pf.messages.length
      ? `<div style="font-size:9px;color:${pf.status === 'ERROR' ? 'var(--red)' : 'var(--yellow)'};margin-top:3px">${pf.messages.map(m => '⚑ ' + m).join('<br>')}</div>`
      : '';
    const tc = !pf.tipo ? 'type-x' : pf.tipo.startsWith('X') ? 'type-x' : pf.tipo.includes('V') ? 'type-dec' : 'type-9';
    const nc = pf.isOccursChild ? 'field-name occurs-child-name' : 'field-name';

    tableRows += `<tr class="${rowClass}">
      <td><span class="${nc}">${escHtml(pf.campo)}</span>${msgHtml}</td>
      <td style="color:var(--text3);font-size:10px;white-space:nowrap">${pf.pos} – ${pf.posEnd}</td>
      <td style="color:var(--yellow)">${pf.largo}</td>
      <td>${pf.tipo ? `<span class="type-badge ${tc}">${pf.tipo}</span>` : '—'}</td>
      <td><code class="val-extracted ${valClass}">${escHtml(pf.raw)}</code></td>
      <td style="color:var(--text2);font-size:10px">${escHtml(pf.trimmed || '')}</td>
      <td>${badge}</td>
    </tr>`;
  }

  let issuesHtml = '';
  if (issues.length > 0) {
    issuesHtml = `<div class="section-title">PROBLEMAS DETECTADOS</div>
    <div class="issues-list">
      ${issues.map(iss => `<div class="issue-item">
        <span class="issue-badge ${iss.level === 'ERROR' ? 'issue-err' : 'issue-warn'}">${iss.level}</span>
        <span class="issue-text"><span class="issue-field">${escHtml(iss.field)}</span> — ${escHtml(iss.msg)}</span>
      </div>`).join('')}
    </div>`;
  }

  const overallStatus = errCount > 0 ? 'error' : warnCount > 0 ? 'warn' : 'success';
  const overallMsg    = errCount > 0
    ? `Validación con errores — ${errCount} error(es), ${warnCount} advertencia(s).`
    : warnCount > 0 ? `Validación con advertencias — ${warnCount} advertencia(s). Sin errores críticos.`
    : 'Validación superada. Todos los campos dentro de parámetros.';

  document.getElementById('valResultContent').innerHTML = `
    <div class="alert alert-${overallStatus}">
      <svg class="icon"><use href="#icon-${overallStatus === 'error' ? 'error' : overallStatus === 'warn' ? 'warning' : 'success'}"></use></svg>
      ${overallMsg} · ${now}
    </div>
    <div class="scoreboard">
      <div class="score-card info"><div class="score-num">${totalFields}</div><div class="score-label">Campos totales</div></div>
      <div class="score-card ok"><div class="score-num">${okCount}</div><div class="score-label">Correctos</div></div>
      <div class="score-card warn"><div class="score-num">${warnCount}</div><div class="score-label">Advertencias</div></div>
      <div class="score-card err"><div class="score-num">${errCount}</div><div class="score-label">Errores</div></div>
      <div class="score-card info"><div class="score-num" style="font-size:20px">${trace.length}<span style="font-size:12px;color:var(--text3)">/${expected}</span></div><div class="score-label">Chars recibidos/esperados</div></div>
    </div>
    ${issuesHtml}
    <div class="section-title">TRAZA COLOREADA</div>
    <div class="alert alert-info" style="font-size:9px;margin-bottom:8px">
      <span style="color:#7dd3fc">■</span> OK &nbsp;
      <span style="color:#ffd700">■</span> Advertencia &nbsp;
      <span style="color:#ff4444">■</span> Error &nbsp;
      <span style="color:#c4b5fd">■</span> OCCURS &nbsp;
      <span style="color:var(--text3)">■</span> FILLER
    </div>
    <div class="trace-display">${colored}</div>
    <div class="btn-row" style="margin-top:14px">
      <button class="btn btn-primary" onclick="navigator.clipboard.writeText(valLastResult.trace).then(()=>valShowAlert('valCopyAlert','success','✓ Traza copiada al portapapeles.'))">
        <svg class="icon"><use href="#icon-copy"></use></svg> COPIAR TRAZA
      </button>
      <button class="btn btn-orange" onclick="valDownloadTXT()">
        <svg class="icon"><use href="#icon-download"></use></svg> REPORTE .TXT
      </button>
      <button class="btn btn-green" onclick="valDownloadCSV()">
        <svg class="icon"><use href="#icon-download"></use></svg> RESULTADO .CSV
      </button>
      <button class="btn btn-secondary" onclick="valSwitchTab('parse')">
        <svg class="icon"><use href="#icon-back"></use></svg> VOLVER
      </button>
    </div>
    <div id="valCopyAlert" style="display:none"></div>
    <div class="sep"></div>
    <div class="section-title">DESGLOSE CAMPO A CAMPO</div>
    <div class="val-table-wrap"><table class="val-table">
      <tr><th>CAMPO</th><th>POSICIÓN</th><th>LARGO</th><th>TIPO</th><th>VALOR RAW</th><th>VALOR TRIM</th><th>ESTADO</th></tr>
      ${tableRows}
    </table></div>`;
}

// ── Downloads ────────────────────────────────────────────
function valDownloadTXT() {
  if (!valLastResult) return;
  const { parsedFields, issues, trace, expected, totalFields, errCount, warnCount, okCount, ts } = valLastResult;
  let txt = '═══════════════════════════════════════════════════════\n';
  txt += '  CICS RESPONSE VALIDATOR — REPORTE DE VALIDACIÓN\n';
  txt += '═══════════════════════════════════════════════════════\n';
  txt += `  Fecha/Hora   : ${new Date(ts).toLocaleString('es-CL')}\n`;
  txt += `  Total campos : ${totalFields}\n  Correctos    : ${okCount}\n`;
  txt += `  Advertencias : ${warnCount}\n  Errores      : ${errCount}\n`;
  txt += `  Longitud     : ${trace.length} chars (esperado: ${expected})\n`;
  txt += '═══════════════════════════════════════════════════════\n\n';
  txt += '── TRAZA COMPLETA (RAW) ───────────────────────────────\n' + trace + '\n\n';

  if (issues.length > 0) {
    txt += '── PROBLEMAS DETECTADOS ───────────────────────────────\n';
    for (const iss of issues) txt += `  [${iss.level.padEnd(5)}] ${iss.field.padEnd(30)} ${iss.msg}\n`;
    txt += '\n';
  }

  txt += '── DESGLOSE CAMPO A CAMPO ────────────────────────────\n';
  txt += `${'CAMPO'.padEnd(35)} ${'POS'.padEnd(10)} ${'LARGO'.padEnd(7)} ${'TIPO'.padEnd(14)} ${'ESTADO'.padEnd(12)} VALOR\n`;
  txt += '─'.repeat(100) + '\n';

  for (const pf of parsedFields) {
    if (pf.isOccursInstanceHeader) { txt += `\n  ◈ ${pf.label}\n`; continue; }
    if (!pf.raw && pf.raw !== '') continue;
    txt += `${pf.campo.padEnd(35)} ${`${pf.pos}–${pf.posEnd}`.padEnd(10)} ${String(pf.largo).padEnd(7)} ${(pf.tipo || 'X').padEnd(14)} ${(pf.isFiller ? 'FILLER' : pf.status).padEnd(12)} |${pf.raw}|\n`;
    for (const m of pf.messages) txt += `  ${''.padEnd(35)} ⚑ ${m}\n`;
  }

  txt += '\n═══════════════════════════════════════════════════════\n';
  txt += '  Generado por CICS Tools Suite\n';
  txt += '═══════════════════════════════════════════════════════\n';

  const a    = document.createElement('a');
  a.download = `validacion_cics_${ts.replace(/[:.]/g, '-').substring(0, 19)}.txt`;
  a.href     = 'data:text/plain;charset=utf-8,' + encodeURIComponent(txt);
  a.click();
}

function valDownloadCSV() {
  if (!valLastResult) return;
  const { parsedFields, ts } = valLastResult;
  const escape = v => `"${String(v).replace(/"/g, '""')}"`;

  let csv = ['CAMPO', 'GRUPO_OCCURS', 'POSICION_INICIO', 'POSICION_FIN', 'LARGO', 'TIPO',
    'VALOR_RAW', 'VALOR_TRIM', 'OBLIG', 'ESTADO', 'MENSAJES'].join(';') + '\n';

  for (const pf of parsedFields) {
    if (pf.isOccursInstanceHeader || (!pf.raw && pf.raw !== '')) continue;
    csv += [
      escape(pf.campo), escape(pf.occursGroup || ''), escape(pf.pos), escape(pf.posEnd),
      escape(pf.largo), escape(pf.tipo || 'X'), escape(pf.raw), escape(pf.trimmed),
      escape(pf.oblig ? 'SI' : 'NO'), escape(pf.isFiller ? 'FILLER' : pf.status),
      escape(pf.messages.join(' | ')),
    ].join(';') + '\n';
  }

  const a    = document.createElement('a');
  a.download = `validacion_cics_${ts.replace(/[:.]/g, '-').substring(0, 19)}.csv`;
  a.href     = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.click();
}

// ── Alerts & utilities ───────────────────────────────────
function valShowAlert(id, type, msg) {
  const el = document.getElementById(id); if (!el) return;
  el.style.display = 'block';
  el.className     = 'alert alert-' + type;
  const icon = type === 'success' ? 'success' : type === 'error' ? 'error' : type === 'warn' ? 'warning' : 'info';
  el.innerHTML = `<svg class="icon"><use href="#icon-${icon}"></use></svg> ${msg}`;
}

function valClearAll() {
  valLayoutFields = []; valOccursGroups = {};
  document.getElementById('valExcelPaste').value = '';
  document.getElementById('valLayoutTableWrap').innerHTML =
    `<div class="alert alert-info"><svg class="icon"><use href="#icon-info"></use></svg> Pega el layout copiado desde una tabla.</div>`;
  document.getElementById('valLayoutActions').style.display = 'none';
  document.getElementById('valLayoutAlert').style.display   = 'none';
}

function valLoadSampleLayout() {
  const sample = `Campo\tLargo\tTipo\tDescripción\tOblig\tValores\nTX-HEADER-FIXED\t25\tX(25)\tHeader transaccional fijo\t\t\nDATOS-RESERVA\t\t\t\t\t\nRV-COD-TRX\t4\tX(04)\tCódigo transacción\tSI\t'RESV','CANC','MODI'\nRV-NUM-RESERVA\t10\tX(010)\tNúmero de reserva\tSI\t\nRV-FEC-ENTRADA\t8\t9(008)\tFecha entrada\tSI\t\nRV-COD-HOTEL\t6\tX(006)\tCódigo hotel\tSI\t\nRV-TIP-HAB\t3\tX(003)\tTipo habitación\tSI\t'SGL','DBL','STE'\nRV-COD-MON\t3\tX(003)\tMoneda\tSI\t'CLP','USD','EUR'`;
  document.getElementById('valExcelPaste').value = sample;
  valParseLayout();
}
