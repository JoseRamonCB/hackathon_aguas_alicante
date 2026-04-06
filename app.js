'use strict';

/* ============================================================
   AquaDetect — app.js
   Datos: data.js (generado desde csv/2_resultados_riesgo_diario.csv)
   Para actualizar los datos: ejecutar update_data.ps1 o launch.bat
   ============================================================ */

// ── Patrones (siempre los mismos, independiente del CSV) ──────
const PATTERN_META = [
    { id:'P1', name:'Ciclos de Consumo',  desc:'Anomalías en ciclos de consumo diario',        icon:'🔄', color:'#3B82F6', bg:'rgba(59,130,246,.12)'  },
    { id:'P2', name:'Ósmosis Inversa',    desc:'Detección de uso de ósmosis inversa',           icon:'💧', color:'#06B6D4', bg:'rgba(6,182,212,.12)'   },
    { id:'P3', name:'Consumo Perpetuo',   desc:'Consumo continuo sin pausas nocturnas',         icon:'♾️',  color:'#8B5CF6', bg:'rgba(139,92,246,.12)'  },
    { id:'P4', name:'Enganche Ilegal',    desc:'Indicios de conexión fraudulenta a la red',    icon:'⚡', color:'#F59E0B', bg:'rgba(245,158,11,.12)'  },
    { id:'P5', name:'Fuga Hídrica',       desc:'Presencia de fugas en la instalación',          icon:'🌊', color:'#EF4444', bg:'rgba(239,68,68,.12)'   },
    { id:'P6', name:'Patrón Eléctrico',   desc:'Score anómalo de consumo eléctrico',            icon:'🔌', color:'#64748B', bg:'rgba(100,116,139,.12)' },
    { id:'RT', name:'Resultado Final',    desc:'Riesgo total combinado (score ponderado)',      icon:'🎯', color:'#1D4ED8', bg:'rgba(29,78,216,.12)'   },
];

// ── Coordenadas de distritos de Alicante ─────────────────────
const DISTRICT_COORDS = {
    Distrito_01:{ lat:38.3360, lng:-0.4910, label:'Distrito 1 — Casco Antiguo'  },
    Distrito_02:{ lat:38.3440, lng:-0.4840, label:'Distrito 2 — Ensanche'       },
    Distrito_03:{ lat:38.3530, lng:-0.4750, label:'Distrito 3 — Carolinas'      },
    Distrito_04:{ lat:38.3610, lng:-0.4680, label:'Distrito 4 — Benalúa Norte'  },
    Distrito_05:{ lat:38.3500, lng:-0.4630, label:'Distrito 5 — Pla del Bon R.' },
    Distrito_06:{ lat:38.3400, lng:-0.4760, label:'Distrito 6 — Centro'         },
    Distrito_07:{ lat:38.3480, lng:-0.4930, label:'Distrito 7 — San Blas'       },
    Distrito_08:{ lat:38.3570, lng:-0.4830, label:'Distrito 8 — Altozano'       },
};

const MESES_ALL = ['2024-01','2024-02','2024-03','2024-04','2024-05','2024-06',
                   '2024-07','2024-08','2024-09','2024-10','2024-11','2024-12'];
const MESES_LABEL = { '2024-01':'Ene','2024-02':'Feb','2024-03':'Mar','2024-04':'Abr',
                      '2024-05':'May','2024-06':'Jun','2024-07':'Jul','2024-08':'Ago',
                      '2024-09':'Sep','2024-10':'Oct','2024-11':'Nov','2024-12':'Dic' };

// ── Estado ────────────────────────────────────────────────────
let DATA = null;
let activeDatasets = new Set(PATTERN_META.map(p => p.id));
let gaugeChart    = null;
let progressChart = null;
let mapInstance   = null;
let heatLayer     = null;
let markerLayer   = null;

// ── Arranque ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (typeof AQUADETECT_DATA === 'undefined') {
        document.getElementById('loading-text').textContent =
            'Error: data.js no encontrado. Ejecuta launch.bat para generar los datos desde el CSV.';
        return;
    }
    DATA = AQUADETECT_DATA;
    bootApp();
});

function bootApp() {
    // Mostrar UI antes de inicializar charts (canvas necesita dimensiones reales)
    document.getElementById('loading-overlay').classList.add('hidden');
    document.getElementById('main-content').classList.remove('hidden');

    const si = document.getElementById('status-indicator');
    si.classList.add('ready');
    document.getElementById('status-text').textContent = 'Sistema activo';

    // Info en footer
    const totalContratos = DATA.contratos?.length ?? 0;
    const totalRegistros = totalContratos * 12; // aprox 12 meses por contrato
    document.getElementById('footer-records').textContent =
        `${totalContratos} contratos · ${DATA.riesgoPorContrato?.length ?? 0} análisis cargados`;

    // Poblar filtro de distritos
    populateRegionFilter();
    // Listeners de filtros
    document.getElementById('btn-apply-filters').addEventListener('click', applyFilters);
    // Render inicial
    applyFilters();
    // Mapa de calor: siempre global, se renderiza una sola vez
    renderHeatmapGlobal();
}

// ── Poblar filtro de distritos ────────────────────────────────
function populateRegionFilter() {
    const sel = document.getElementById('filter-region');
    const regiones = [...new Set(DATA.contratos.map(c => c.region))].sort();
    regiones.forEach(r => {
        const o = document.createElement('option');
        o.value = r;
        o.textContent = DISTRICT_COORDS[r]?.label || r;
        sel.appendChild(o);
    });
}

// ── Helper: obtener rango de meses ────────────────────────────
function getPeriodo(val) {
    if (val === 'TODOS') return ['2024-01', '2024-12'];
    return val.split(',');
}

// ═══════════════════════════════════════════════════════════════
//  APLICAR FILTROS
// ═══════════════════════════════════════════════════════════════

function applyFilters() {
    const region  = document.getElementById('filter-region').value;
    const umbral  = parseFloat(document.getElementById('filter-umbral').value) || 0;
    const periodo = document.getElementById('filter-periodo').value;

    const [mesI, mesF] = getPeriodo(periodo);
    const mesesRango   = MESES_ALL.filter(m => m >= mesI && m <= mesF);

    // 1. Contratos que pasan el filtro de distrito
    let contratos = DATA.contratos.filter(c =>
        region === 'TODOS' || c.region === region
    );

    // 2. Calcular riesgo promedio en el período para cada contrato → filtrar por umbral
    contratos = contratos.map(c => {
        const ev = DATA.evolucionMensual[c.id] || [];
        const enRango = ev.filter(d => d.mes >= mesI && d.mes <= mesF);
        const avgRT = enRango.length
            ? parseFloat((enRango.reduce((a, d) => a + (d.RT || 0), 0) / enRango.length).toFixed(2))
            : 0;
        const maxRT = enRango.length
            ? parseFloat(Math.max(...enRango.map(d => d.RT || 0)).toFixed(2))
            : 0;
        return { ...c, avgRT, maxRT };
    }).filter(c => c.avgRT >= umbral);

    if (contratos.length === 0) {
        showToast('⚠️ No hay contratos que cumplan el umbral seleccionado. Reduce el umbral.', 'warn');
        return;
    }

    const ids = new Set(contratos.map(c => c.id));

    // 3. Agregar datos mensuales (promedio del grupo de contratos filtrado)
    const mesData = Object.fromEntries(PATTERN_META.map(p => [p.id, []]));
    mesesRango.forEach(mes => {
        const sums = Object.fromEntries(PATTERN_META.map(p => [p.id, 0]));
        let count = 0;
        ids.forEach(id => {
            const d = (DATA.evolucionMensual[id] || []).find(x => x.mes === mes);
            if (!d) return;
            PATTERN_META.forEach(p => { sums[p.id] += (d[p.id] ?? 0); });
            count++;
        });
        PATTERN_META.forEach(p => {
            mesData[p.id].push(count > 0 ? parseFloat((sums[p.id] / count).toFixed(2)) : 0);
        });
    });

    // 4. Valores del último mes del rango (para patrones y gauge)
    const lastIdx    = mesesRango.length - 1;
    const finalRT    = lastIdx >= 0 ? mesData.RT[lastIdx] : 0;
    const finalPats  = Object.fromEntries(
        PATTERN_META.filter(p => p.id !== 'RT')
                    .map(p => [p.id, lastIdx >= 0 ? mesData[p.id][lastIdx] : 0])
    );

    // 5. Stats globales del grupo
    const allRisks  = contratos.map(c => c.avgRT);
    const avgGlobal = parseFloat((allRisks.reduce((a, b) => a + b, 0) / allRisks.length).toFixed(2));
    const maxGlobal = parseFloat(Math.max(...allRisks).toFixed(2));
    const criticos  = contratos.filter(c => c.avgRT >= 30).length;

    // ── Render ──
    const labels = mesesRango.map(m => MESES_LABEL[m] || m);
    updateFilterStats(contratos.length, avgGlobal, maxGlobal, criticos, region, mesI, mesF);
    updatePatternsPanel(finalPats, contratos.length, region, mesI, mesF);
    updateGauge(finalRT, avgGlobal, maxGlobal);
    updateProgressChart(labels, mesData);
}

// ═══════════════════════════════════════════════════════════════
//  STATS BAR
// ═══════════════════════════════════════════════════════════════

function updateFilterStats(n, avg, max, criticos, region, mesI, mesF) {
    document.getElementById('stat-contratos').textContent =
        `${n} contrato${n !== 1 ? 's' : ''}`;
    document.getElementById('stat-region').textContent =
        region === 'TODOS' ? 'Todos los distritos' : (DISTRICT_COORDS[region]?.label || region);
    document.getElementById('stat-periodo').textContent =
        `${MESES_LABEL[mesI] || mesI} – ${MESES_LABEL[mesF] || mesF}`;
    document.getElementById('stat-riesgo-max').textContent = `Pico: ${max}%`;
    document.getElementById('stat-riesgo-avg').textContent = `Media: ${avg}%`;
    document.getElementById('stat-alertas').textContent = `Alertas críticas (≥30%): ${criticos}`;
}

// ═══════════════════════════════════════════════════════════════
//  PANEL DE PATRONES
// ═══════════════════════════════════════════════════════════════

function updatePatternsPanel(patValues, nContratos, region, mesI, mesF) {
    const list = document.getElementById('patterns-list');
    list.innerHTML = '';

    const distLabel = region === 'TODOS' ? 'Todos los distritos' : (DISTRICT_COORDS[region]?.label || region);
    document.getElementById('patterns-subtitle').textContent =
        `Promedio de ${nContratos} contrato${nContratos !== 1 ? 's' : ''} · ${distLabel} · ${MESES_LABEL[mesI]}–${MESES_LABEL[mesF]}`;

    PATTERN_META.filter(p => p.id !== 'RT').forEach((p, i) => {
        const val   = patValues[p.id] ?? 0;
        const pct   = Math.min(100, Math.max(0, val));
        const color = val >= 66 ? '#EF4444' : val >= 33 ? '#F59E0B' : '#22C55E';

        const card = document.createElement('div');
        card.className = 'pattern-card';
        card.style.animationDelay = `${i * 0.06}s`;
        card.innerHTML = `
            <div class="pattern-icon" style="background:${p.bg};color:${p.color}">${p.icon}</div>
            <div class="pattern-info">
                <div class="pattern-name">${p.name}</div>
                <div class="pattern-desc">${p.desc}</div>
            </div>
            <div class="pattern-value">
                <span class="pattern-percent" style="color:${color}">${val.toFixed(1)}</span>
                <div class="pattern-bar-track">
                    <div class="pattern-bar-fill" style="background:${color}" data-width="${pct}"></div>
                </div>
            </div>`;
        list.appendChild(card);
    });

    requestAnimationFrame(() => requestAnimationFrame(() => {
        document.querySelectorAll('.pattern-bar-fill').forEach(b => { b.style.width = b.dataset.width + '%'; });
    }));
}

// ═══════════════════════════════════════════════════════════════
//  GAUGE
// ═══════════════════════════════════════════════════════════════

function updateGauge(value, avgGlobal, maxGlobal) {
    const pct = Math.min(100, Math.max(0, value));

    if (gaugeChart) { gaugeChart.destroy(); gaugeChart = null; }

    const fillColor = pct >= 30 ? '#EF4444' : pct >= 15 ? '#F59E0B' : '#2563EB';

    gaugeChart = new Chart(
        document.getElementById('gauge-chart').getContext('2d'),
        {
            type: 'doughnut',
            data: { datasets: [{ data:[0, 100], backgroundColor:[fillColor,'#F1F5F9'], borderWidth:0, borderRadius:6, spacing:2 }] },
            options: {
                responsive:true, maintainAspectRatio:true, cutout:'78%',
                rotation:-90, circumference:360,
                plugins:{ legend:{display:false}, tooltip:{enabled:false} },
                animation:{ animateRotate:true, duration:1600, easing:'easeOutQuart' },
            },
        }
    );

    const valEl = document.getElementById('gauge-value');
    const badge = document.getElementById('risk-badge');
    const note  = document.getElementById('gauge-note');

    let cur = 0;
    const step = pct / 60;
    const iv = setInterval(() => {
        cur += step;
        if (cur >= pct) { cur = pct; clearInterval(iv); }
        valEl.textContent = cur.toFixed(1) + '%';
        gaugeChart.data.datasets[0].data = [cur, 100 - cur];
        gaugeChart.update('none');
    }, 20);

    const risk = pct >= 30
        ? { text:'🚨 Riesgo Alto — Posible Plantación Ilegal', cls:'risk-high',   col:'#DC2626' }
        : pct >= 15
        ? { text:'⚠️ Riesgo Medio — Requiere Investigación',  cls:'risk-medium', col:'#D97706' }
        : { text:'✅ Riesgo Bajo — Sin Evidencias Claras',    cls:'risk-low',    col:'#16A34A' };

    badge.className = `risk-badge ${risk.cls}`;
    badge.querySelector('.risk-text').textContent = risk.text;
    valEl.style.color = risk.col;
    note.textContent = `Promedio del grupo: ${avgGlobal}% · Pico: ${maxGlobal}% · Rango del dataset: 0–42.72%`;
}

// ═══════════════════════════════════════════════════════════════
//  GRÁFICA DE EVOLUCIÓN
// ═══════════════════════════════════════════════════════════════

function initToggleButtons() {
    const container = document.getElementById('chart-toggles');
    if (container.hasChildNodes()) return;

    const allBtn = document.createElement('button');
    allBtn.className = 'toggle-btn active'; allBtn.id = 'toggle-all';
    allBtn.textContent = 'Todos';
    allBtn.addEventListener('click', () => {
        const all = activeDatasets.size === PATTERN_META.length;
        if (all) activeDatasets.clear(); else PATTERN_META.forEach(p => activeDatasets.add(p.id));
        syncToggles(); syncChartVisibility();
    });
    container.appendChild(allBtn);

    PATTERN_META.forEach(p => {
        const btn = document.createElement('button');
        btn.className = `toggle-btn ${activeDatasets.has(p.id) ? 'active' : ''}`;
        btn.dataset.key = p.id;
        btn.innerHTML = `<span class="toggle-dot" style="background:${p.color}"></span>${p.name}`;
        btn.addEventListener('click', () => {
            activeDatasets.has(p.id) ? activeDatasets.delete(p.id) : activeDatasets.add(p.id);
            syncToggles(); syncChartVisibility();
        });
        container.appendChild(btn);
    });
}

function syncToggles() {
    const allBtn = document.getElementById('toggle-all');
    if (allBtn) allBtn.classList.toggle('active', activeDatasets.size === PATTERN_META.length);
    document.querySelectorAll('.toggle-btn[data-key]').forEach(btn => {
        btn.classList.toggle('active', activeDatasets.has(btn.dataset.key));
    });
}

function syncChartVisibility() {
    if (!progressChart) return;
    progressChart.data.datasets.forEach(ds => { ds.hidden = !activeDatasets.has(ds._id); });
    progressChart.update();
}

function updateProgressChart(labels, mesData) {
    initToggleButtons();
    if (progressChart) { progressChart.destroy(); progressChart = null; }

    const datasets = PATTERN_META.map(p => {
        const isRT = p.id === 'RT';
        return {
            _id: p.id, label: p.name,
            data: mesData[p.id] || [],
            borderColor: p.color,
            backgroundColor: isRT ? `${p.color}18` : 'transparent',
            borderWidth: isRT ? 3 : 1.8,
            pointRadius: isRT ? 4 : 2.5,
            pointHoverRadius: 6, pointBackgroundColor: p.color,
            tension: 0.35, fill: isRT,
            hidden: !activeDatasets.has(p.id),
        };
    });

    progressChart = new Chart(
        document.getElementById('progress-chart').getContext('2d'),
        {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive:true, maintainAspectRatio:false,
                interaction:{ mode:'index', intersect:false },
                plugins:{
                    legend:{ display:false },
                    tooltip:{
                        backgroundColor:'rgba(15,23,42,.92)',
                        titleFont:{ family:'Inter', size:12, weight:'600' },
                        bodyFont:{ family:'Inter', size:11 },
                        padding:12, cornerRadius:8, boxPadding:4,
                        callbacks:{ label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}` },
                    },
                },
                scales:{
                    x:{ grid:{ color:'rgba(226,232,240,.6)', drawBorder:false }, ticks:{ font:{family:'Inter',size:11}, color:'#94A3B8' } },
                    y:{ min:0, grid:{ color:'rgba(226,232,240,.6)', drawBorder:false }, ticks:{ font:{family:'Inter',size:11}, color:'#94A3B8', callback:v=>v.toFixed(0) } },
                },
                animation:{ duration:800, easing:'easeOutCubic' },
            },
        }
    );

    document.getElementById('progress-subtitle').textContent =
        `Evolución mensual — ${labels.length} período${labels.length !== 1 ? 's' : ''}`;
}

// ═══════════════════════════════════════════════════════════════
//  MAPA DE CALOR — SIEMPRE GLOBAL (todos los distritos)
//  Se renderiza una sola vez al cargar; los filtros NO lo afectan.
// ═══════════════════════════════════════════════════════════════

function contractOffset(id, scale = 0.006) {
    const n = parseInt(id.replace(/\D/g, '')) || 0;
    const angle = (n * 137.5) * (Math.PI / 180);
    const r = scale * ((n % 5) / 5 + 0.3);
    return { dlat: Math.sin(angle) * r, dlng: Math.cos(angle) * r };
}

function formatPerfil(p) {
    const m = {
        Plantacion_Ilegal:'🚨 Plantación Ilegal', Familia_Estandar:'🏠 Familia Estándar',
        Trabajador_Presencial:'💼 Trabajador Presencial', Jubilados:'👴 Jubilados',
        Teletrabajo:'💻 Teletrabajo', Segunda_Residencia:'🏖️ Segunda Residencia', Turno_Noche:'🌙 Turno Noche',
    };
    return m[p] || p.replace(/_/g, ' ');
}

function renderHeatmapGlobal() {
    // Usar riesgoPorContrato (promedio anual completo de cada contrato, sin filtros)
    const allContratos = DATA.riesgoPorContrato || [];
    if (!allContratos.length) return;

    const heatData = allContratos.map(c => {
        const dist = DISTRICT_COORDS[c.region];
        if (!dist) return null;
        const off = contractOffset(c.id);
        return { ...c, lat: dist.lat + off.dlat, lng: dist.lng + off.dlng };
    }).filter(Boolean);

    if (!mapInstance) {
        mapInstance = L.map('heatmap', { scrollWheelZoom: false }).setView([38.347, -0.480], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            subdomains: 'abcd', maxZoom: 19,
        }).addTo(mapInstance);
    }

    if (heatLayer)   { mapInstance.removeLayer(heatLayer);   heatLayer   = null; }
    if (markerLayer) { mapInstance.removeLayer(markerLayer); markerLayer = null; }

    const maxRisk = Math.max(...heatData.map(d => d.avg), 1);

    heatLayer = L.heatLayer(
        heatData.map(d => [d.lat, d.lng, d.avg / maxRisk]),
        { radius:32, blur:24, maxZoom:17, max:1.0,
          gradient:{ 0:'#3B82F6', .3:'#60A5FA', .5:'#22C55E', .65:'#F59E0B', .8:'#EF4444', 1:'#DC2626' } }
    ).addTo(mapInstance);

    // Marcadores para contratos con riesgo en la mitad superior
    const threshold = maxRisk * 0.5;
    markerLayer = L.layerGroup();
    heatData.filter(d => d.avg >= threshold).sort((a, b) => b.avg - a.avg).forEach(d => {
        const col = d.avg >= 30 ? '#DC2626' : d.avg >= 15 ? '#D97706' : '#16A34A';
        L.circleMarker([d.lat, d.lng], {
            radius: 5 + (d.avg / maxRisk) * 4,
            fillColor: col, color: '#fff', weight: 1.5, fillOpacity: 0.9,
        }).addTo(markerLayer).bindPopup(`
            <div style="font-family:Inter,sans-serif;min-width:170px;padding:2px">
                <div style="font-weight:700;font-size:.9em;margin-bottom:3px">${d.id}</div>
                <div style="font-size:.75em;color:#64748B;margin-bottom:2px">${DISTRICT_COORDS[d.region]?.label || d.region}</div>
                <div style="font-size:.75em;color:#64748B;margin-bottom:8px">${formatPerfil(d.perfil)}</div>
                <div style="display:flex;align-items:center;gap:6px">
                    <span style="width:9px;height:9px;border-radius:50%;background:${col};display:inline-block;flex-shrink:0"></span>
                    <strong style="font-size:1.1em;color:${col}">${d.avg.toFixed(1)}%</strong>
                    <span style="font-size:.72em;color:#94A3B8">riesgo promedio anual</span>
                </div>
                <div style="font-size:.72em;color:#94A3B8;margin-top:2px">Pico histórico: ${d.max.toFixed(1)}%</div>
            </div>`);
    });
    markerLayer.addTo(mapInstance);
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
    let t = document.getElementById('aq-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'aq-toast';
        Object.assign(t.style, {
            position:'fixed', bottom:'28px', left:'50%', transform:'translateX(-50%)',
            padding:'10px 20px', borderRadius:'999px', fontSize:'.82rem', fontWeight:'600',
            fontFamily:'Inter,sans-serif', zIndex:'9999', transition:'opacity .4s ease',
            boxShadow:'0 8px 30px rgba(0,0,0,.15)', whiteSpace:'nowrap',
        });
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = type === 'warn' ? '#FEF3C7' : type === 'error' ? '#FEE2E2' : '#DBEAFE';
    t.style.color       = type === 'warn' ? '#92400E' : type === 'error' ? '#991B1B'  : '#1E40AF';
    t.style.opacity = '1';
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.style.opacity = '0'; }, 4500);
}
