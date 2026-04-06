/* ============================================
   AquaDetect — Application Logic
   ============================================ */

// ========================
// Mock Data
// ========================

const PATTERNS = [
    {
        id: 'consumo',
        name: 'Consumo Eléctrico Anómalo',
        desc: 'Picos de consumo en horarios nocturnos',
        icon: '⚡',
        color: '#F59E0B',
        bgColor: 'rgba(245, 158, 11, 0.12)',
        value: 82,
    },
    {
        id: 'agua',
        name: 'Consumo de Agua Elevado',
        desc: 'Uso desproporcionado respecto a la media',
        icon: '💧',
        color: '#3B82F6',
        bgColor: 'rgba(59, 130, 246, 0.12)',
        value: 74,
    },
    {
        id: 'termico',
        name: 'Anomalía Térmica',
        desc: 'Firma térmica superior a viviendas colindantes',
        icon: '🌡️',
        color: '#EF4444',
        bgColor: 'rgba(239, 68, 68, 0.12)',
        value: 68,
    },
    {
        id: 'ventilacion',
        name: 'Sistema de Ventilación',
        desc: 'Detección de extractores industriales',
        icon: '🌀',
        color: '#8B5CF6',
        bgColor: 'rgba(139, 92, 246, 0.12)',
        value: 55,
    },
    {
        id: 'actividad',
        name: 'Patrón de Actividad',
        desc: 'Movimiento sospechoso en horarios inusuales',
        icon: '👁️',
        color: '#06B6D4',
        bgColor: 'rgba(6, 182, 212, 0.12)',
        value: 42,
    },
    {
        id: 'historico',
        name: 'Historial de Alertas',
        desc: 'Alertas previas en la zona',
        icon: '📋',
        color: '#64748B',
        bgColor: 'rgba(100, 116, 139, 0.12)',
        value: 30,
    },
];

const PROGRESS_LABELS = [
    'Mar 7', 'Mar 10', 'Mar 13', 'Mar 16', 'Mar 19',
    'Mar 22', 'Mar 25', 'Mar 28', 'Mar 31', 'Abr 3', 'Abr 6',
];

const PROGRESS_DATA = {
    consumo:     [40, 45, 52, 60, 63, 70, 72, 75, 78, 80, 82],
    agua:        [30, 35, 40, 50, 55, 58, 62, 65, 70, 72, 74],
    termico:     [20, 28, 35, 42, 48, 50, 55, 58, 62, 65, 68],
    ventilacion: [10, 15, 20, 28, 32, 38, 42, 45, 48, 52, 55],
    actividad:   [5,  8,  12, 18, 22, 26, 30, 34, 37, 40, 42],
    historico:   [15, 16, 18, 20, 22, 24, 25, 26, 28, 29, 30],
    resultado:   [25, 30, 38, 46, 50, 55, 58, 62, 65, 68, 72],
};

// Alicante area heat data [lat, lng, intensity]
const HEATMAP_DATA = [
    [38.3452, -0.4810, 0.92], [38.3460, -0.4790, 0.88], [38.3448, -0.4835, 0.45],
    [38.3500, -0.4850, 0.70], [38.3510, -0.4800, 0.65], [38.3480, -0.4780, 0.82],
    [38.3420, -0.4860, 0.35], [38.3440, -0.4750, 0.55], [38.3490, -0.4720, 0.40],
    [38.3530, -0.4770, 0.75], [38.3545, -0.4830, 0.60], [38.3470, -0.4700, 0.30],
    [38.3410, -0.4900, 0.25], [38.3520, -0.4900, 0.50], [38.3555, -0.4750, 0.85],
    [38.3430, -0.4820, 0.78], [38.3465, -0.4870, 0.62], [38.3505, -0.4740, 0.48],
    [38.3485, -0.4690, 0.33], [38.3560, -0.4810, 0.90], [38.3400, -0.4780, 0.55],
    [38.3475, -0.4760, 0.72], [38.3515, -0.4860, 0.58], [38.3435, -0.4710, 0.40],
    [38.3550, -0.4700, 0.68], [38.3495, -0.4880, 0.80], [38.3445, -0.4740, 0.52],
    [38.3525, -0.4720, 0.37], [38.3415, -0.4840, 0.48], [38.3540, -0.4760, 0.73],
];

// ========================
// Utility
// ========================

function getColorForValue(value) {
    if (value >= 75) return '#EF4444';
    if (value >= 50) return '#F59E0B';
    return '#22C55E';
}

function getRiskLevel(value) {
    if (value >= 75) return { text: 'Riesgo Alto', class: 'risk-high' };
    if (value >= 50) return { text: 'Riesgo Medio', class: 'risk-medium' };
    return { text: 'Riesgo Bajo', class: 'risk-low' };
}

// ========================
// Patterns Panel
// ========================

function renderPatterns() {
    const list = document.getElementById('patterns-list');
    list.innerHTML = '';

    PATTERNS.forEach((p, i) => {
        const card = document.createElement('div');
        card.className = 'pattern-card';
        card.style.animationDelay = `${i * 0.07}s`;

        const valueColor = getColorForValue(p.value);

        card.innerHTML = `
            <div class="pattern-icon" style="background:${p.bgColor};color:${p.color}">
                ${p.icon}
            </div>
            <div class="pattern-info">
                <div class="pattern-name">${p.name}</div>
                <div class="pattern-desc">${p.desc}</div>
            </div>
            <div class="pattern-value">
                <span class="pattern-percent" style="color:${valueColor}">${p.value}%</span>
                <div class="pattern-bar-track">
                    <div class="pattern-bar-fill" style="background:${valueColor}" data-width="${p.value}"></div>
                </div>
            </div>
        `;

        list.appendChild(card);
    });

    // Animate bars after next paint
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            document.querySelectorAll('.pattern-bar-fill').forEach(bar => {
                bar.style.width = bar.dataset.width + '%';
            });
        });
    });
}

// ========================
// Gauge Chart (Doughnut)
// ========================

let gaugeChart = null;

function createGaugeChart() {
    const ctx = document.getElementById('gauge-chart').getContext('2d');
    const finalValue = 72;
    const remaining = 100 - finalValue;

    const gradientFill = ctx.createLinearGradient(0, 0, 280, 280);
    gradientFill.addColorStop(0, '#2563EB');
    gradientFill.addColorStop(1, '#60A5FA');

    gaugeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Probabilidad', 'Restante'],
            datasets: [{
                data: [0, 100],
                backgroundColor: [gradientFill, '#F1F5F9'],
                borderWidth: 0,
                borderRadius: 8,
                spacing: 2,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '78%',
            rotation: -90,
            circumference: 360,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false },
            },
            animation: {
                animateRotate: true,
                duration: 1800,
                easing: 'easeOutQuart',
            },
        },
    });

    // Animate value
    animateGaugeValue(finalValue);
}

function animateGaugeValue(target) {
    const valueEl = document.getElementById('gauge-value');
    const badgeEl = document.getElementById('risk-badge');
    const risk = getRiskLevel(target);

    badgeEl.className = `risk-badge ${risk.class}`;
    badgeEl.querySelector('.risk-text').textContent = risk.text;

    // Animate the number
    let current = 0;
    const step = target / 60;
    const interval = setInterval(() => {
        current += step;
        if (current >= target) {
            current = target;
            clearInterval(interval);
        }
        valueEl.textContent = Math.round(current) + '%';

        // Update chart data
        gaugeChart.data.datasets[0].data = [Math.round(current), 100 - Math.round(current)];
        gaugeChart.update('none');
    }, 25);

    // Color shift
    if (target >= 75) {
        valueEl.style.color = '#DC2626';
    } else if (target >= 50) {
        valueEl.style.color = '#D97706';
    } else {
        valueEl.style.color = '#1D4ED8';
    }
}

// ========================
// Progress Chart (Line)
// ========================

let progressChart = null;
const activeDatasets = new Set(['consumo', 'agua', 'termico', 'ventilacion', 'actividad', 'historico', 'resultado']);

const DATASET_COLORS = {
    consumo: '#F59E0B',
    agua: '#3B82F6',
    termico: '#EF4444',
    ventilacion: '#8B5CF6',
    actividad: '#06B6D4',
    historico: '#64748B',
    resultado: '#1D4ED8',
};

const DATASET_LABELS = {
    consumo: 'Consumo Eléctrico',
    agua: 'Consumo Agua',
    termico: 'Anomalía Térmica',
    ventilacion: 'Ventilación',
    actividad: 'Actividad',
    historico: 'Historial',
    resultado: 'Resultado Final',
};

function createToggleButtons() {
    const container = document.getElementById('chart-toggles');
    container.innerHTML = '';

    // "Todos" button
    const allBtn = document.createElement('button');
    allBtn.className = 'toggle-btn active';
    allBtn.id = 'toggle-all';
    allBtn.textContent = 'Todos';
    allBtn.addEventListener('click', () => {
        const allActive = activeDatasets.size === Object.keys(PROGRESS_DATA).length;
        if (allActive) {
            activeDatasets.clear();
        } else {
            Object.keys(PROGRESS_DATA).forEach(k => activeDatasets.add(k));
        }
        updateToggleStates();
        updateProgressChart();
    });
    container.appendChild(allBtn);

    // Individual buttons
    Object.keys(PROGRESS_DATA).forEach(key => {
        const btn = document.createElement('button');
        btn.className = `toggle-btn ${activeDatasets.has(key) ? 'active' : ''}`;
        btn.dataset.key = key;
        btn.innerHTML = `<span class="toggle-dot" style="background:${DATASET_COLORS[key]}"></span>${DATASET_LABELS[key]}`;
        btn.addEventListener('click', () => {
            if (activeDatasets.has(key)) {
                activeDatasets.delete(key);
            } else {
                activeDatasets.add(key);
            }
            updateToggleStates();
            updateProgressChart();
        });
        container.appendChild(btn);
    });
}

function updateToggleStates() {
    const allBtn = document.getElementById('toggle-all');
    const allActive = activeDatasets.size === Object.keys(PROGRESS_DATA).length;
    allBtn.classList.toggle('active', allActive);

    document.querySelectorAll('.toggle-btn[data-key]').forEach(btn => {
        btn.classList.toggle('active', activeDatasets.has(btn.dataset.key));
    });
}

function buildDatasets() {
    return Object.keys(PROGRESS_DATA).map(key => {
        const color = DATASET_COLORS[key];
        const isResult = key === 'resultado';
        return {
            label: DATASET_LABELS[key],
            data: PROGRESS_DATA[key],
            borderColor: color,
            backgroundColor: isResult ? `${color}18` : 'transparent',
            borderWidth: isResult ? 3 : 2,
            pointRadius: isResult ? 4 : 2,
            pointHoverRadius: 6,
            pointBackgroundColor: color,
            tension: 0.35,
            fill: isResult,
            hidden: !activeDatasets.has(key),
            borderDash: isResult ? [] : [0],
        };
    });
}

function createProgressChart() {
    const ctx = document.getElementById('progress-chart').getContext('2d');

    progressChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: PROGRESS_LABELS,
            datasets: buildDatasets(),
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { family: 'Inter', size: 12, weight: '600' },
                    bodyFont: { family: 'Inter', size: 11 },
                    padding: 12,
                    cornerRadius: 8,
                    boxPadding: 4,
                    callbacks: {
                        label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}%`,
                    },
                },
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(226, 232, 240, 0.6)',
                        drawBorder: false,
                    },
                    ticks: {
                        font: { family: 'Inter', size: 11 },
                        color: '#94A3B8',
                    },
                },
                y: {
                    min: 0,
                    max: 100,
                    grid: {
                        color: 'rgba(226, 232, 240, 0.6)',
                        drawBorder: false,
                    },
                    ticks: {
                        font: { family: 'Inter', size: 11 },
                        color: '#94A3B8',
                        callback: (v) => v + '%',
                        stepSize: 20,
                    },
                },
            },
            animation: {
                duration: 1200,
                easing: 'easeOutCubic',
            },
        },
    });
}

function updateProgressChart() {
    if (!progressChart) return;
    progressChart.data.datasets = buildDatasets();
    progressChart.update();
}

// ========================
// Heatmap (Leaflet)
// ========================

function createHeatmap() {
    const map = L.map('heatmap', {
        scrollWheelZoom: false,
    }).setView([38.3475, -0.4810], 15);

    // Clean-looking tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
    }).addTo(map);

    // Heat layer
    const heatData = HEATMAP_DATA.map(([lat, lng, intensity]) => [lat, lng, intensity]);

    L.heatLayer(heatData, {
        radius: 35,
        blur: 25,
        maxZoom: 17,
        max: 1.0,
        gradient: {
            0.0: '#3B82F6',
            0.25: '#60A5FA',
            0.5: '#22C55E',
            0.65: '#F59E0B',
            0.8: '#EF4444',
            1.0: '#DC2626',
        },
    }).addTo(map);

    // Add some marker dots for highest risk areas
    const highRiskAreas = HEATMAP_DATA.filter(d => d[2] >= 0.8);
    highRiskAreas.forEach(([lat, lng, intensity]) => {
        const pct = Math.round(intensity * 100);
        L.circleMarker([lat, lng], {
            radius: 6,
            fillColor: '#DC2626',
            color: '#fff',
            weight: 2,
            fillOpacity: 0.9,
        }).addTo(map).bindPopup(
            `<div style="font-family:Inter,sans-serif;text-align:center;">
                <strong style="font-size:1.1em;color:#DC2626;">${pct}%</strong><br>
                <span style="font-size:0.85em;color:#64748B;">Probabilidad detectada</span>
            </div>`
        );
    });
}

// ========================
// Filter Interaction (Simulated)
// ========================

function setupFilters() {
    const btn = document.getElementById('btn-apply-filters');
    btn.addEventListener('click', () => {
        btn.textContent = 'Analizando...';
        btn.disabled = true;
        btn.style.opacity = '0.7';

        // Simulate refresh with randomized data
        setTimeout(() => {
            PATTERNS.forEach(p => {
                p.value = Math.min(98, Math.max(15, p.value + Math.round((Math.random() - 0.4) * 20)));
            });

            renderPatterns();

            // Update gauge
            const avg = Math.round(PATTERNS.reduce((s, p) => s + p.value, 0) / PATTERNS.length);
            animateGaugeValue(avg);

            // Update subtitle
            const barrio = document.getElementById('filter-barrio');
            const zona = document.getElementById('filter-zona');
            const sector = document.getElementById('filter-sector');
            const subtitle = `${barrio.options[barrio.selectedIndex].text} — ${zona.options[zona.selectedIndex].text} — ${sector.options[sector.selectedIndex].text}`;
            document.querySelector('#patterns-panel .panel-subtitle').textContent = subtitle;

            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5"/><path d="M11.5 11.5L15 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                Analizar
            `;
            btn.disabled = false;
            btn.style.opacity = '1';
        }, 800);
    });
}

// ========================
// Init
// ========================

document.addEventListener('DOMContentLoaded', () => {
    renderPatterns();
    createGaugeChart();
    createToggleButtons();
    createProgressChart();
    createHeatmap();
    setupFilters();
});
