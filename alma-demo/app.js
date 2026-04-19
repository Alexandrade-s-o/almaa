// ALMA — demo local (sin servidor ni base de datos)
// Colores gráficos = manual de marca ALMA (teal, ámbar, grises, semánticos)

const STORAGE_THRESH = 'alma_thresholds';

const C = {
  teal400: '#1d9f75',
  teal200: '#5dc3a5',
  teal100: '#bfeddb',
  teal800: '#085041',
  amber400: '#ef9f27',
  amber600: '#ba7517',
  gris700: '#3d3d3a',
  gris400: '#8b8780',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6'
};

/** Lotes de ejemplo (solo demostración) */
const DEMO_LOTES = [
  { id: 'L-01', cultivo: 'Café', humedad: 42, mos: 4.2, ndvi: 0.72 },
  { id: 'L-02', cultivo: 'Maíz', humedad: 18, mos: 3.1, ndvi: 0.55 },
  { id: 'L-03', cultivo: 'Caña', humedad: 51, mos: 5.0, ndvi: 0.81 },
  { id: 'L-04', cultivo: 'Banano', humedad: 63, mos: 4.8, ndvi: 0.68 },
  { id: 'L-05', cultivo: 'Aguacate', humedad: 15, mos: 2.9, ndvi: 0.48 }
];

let mainChart = null;
let carbonChart = null;
let uafTrendChart = null;
let loraRssiChart = null;
let minionChart = null;
let cachedData = [];

document.addEventListener('DOMContentLoaded', () => {
  loadThresholdInputs();
  refreshData();

  initNavigation();
  initConfigHandlers();

  const geminiBtn = document.getElementById('btn-gemini-analyze');
  if (geminiBtn) geminiBtn.addEventListener('click', () => runDemoDiagnosis());
});

function getThresholds() {
  try {
    const raw = localStorage.getItem(STORAGE_THRESH);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { humedadMin: 20, ndviMin: 0.45 };
}

function loadThresholdInputs() {
  const t = getThresholds();
  const h = document.getElementById('cfg-humedad');
  const n = document.getElementById('cfg-ndvi');
  if (h) h.value = t.humedadMin;
  if (n) n.value = t.ndviMin;
}

function initConfigHandlers() {
  const saveBtn = document.getElementById('btn-save-thresholds');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const h = parseFloat(document.getElementById('cfg-humedad')?.value) || 20;
      const n = parseFloat(document.getElementById('cfg-ndvi')?.value) || 0.45;
      localStorage.setItem(STORAGE_THRESH, JSON.stringify({ humedadMin: h, ndviMin: n }));
      updateKPIs(cachedData);
      renderUAFTable(cachedData);
      renderUAFViews(cachedData);
      renderMainChart(cachedData);
    });
  }
}

function initNavigation() {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', function () {
      const viewId = this.getAttribute('data-view');

      document.querySelectorAll('.nav-item').forEach((i) => i.classList.remove('active'));
      this.classList.add('active');

      document.querySelectorAll('.app-view').forEach((v) => {
        v.classList.remove('active');
        v.style.display = 'none';
      });
      const targetView = document.getElementById('view-' + viewId);
      if (targetView) {
        targetView.style.display = 'block';
        targetView.classList.add('active');
      }

      updateViewTitles(viewId);

      if (viewId === 'carbon') renderCarbonChart();
      if (viewId === 'dashboard') renderMainChart(cachedData);
      if (viewId === 'uaf') renderUAFViews(cachedData);
      if (viewId === 'lora') renderLoraViews(cachedData);
      if (viewId === 'minion') renderMinionChart();
    });
  });
}

function updateViewTitles(view) {
  const title = document.getElementById('view-title');
  const sub = document.getElementById('view-subtitle');
  const map = {
    dashboard: ['Neuralzoo Command Center', 'Plataforma integral de agricultura regenerativa'],
    uaf: ['Gestión UAF', 'Unidades agrícolas de funcionamiento y lotes'],
    lora: ['Nodos LoRaWAN', 'Conectividad de campo y telemetría Neuralzoo'],
    minion: ['Secuenciación de ADN', 'Bioinformática nanoportátil in situ'],
    carbon: ['Créditos de carbono', 'Monitoreo de secuestro de CO₂e (VM0017)'],
    config: ['Configuración', 'Umbrales para la demo y cómo funciona esta versión']
  };
  const pair = map[view] || map.dashboard;
  title.innerText = pair[0];
  sub.innerText = pair[1];
}

function refreshData() {
  cachedData = DEMO_LOTES.map((row) => ({ ...row }));
  applyDataToUI();
}

function applyDataToUI() {
  updateKPIs(cachedData);
  renderUAFTable(cachedData);
  renderMainChart(cachedData);
  renderUAFViews(cachedData);
  renderLoraViews(cachedData);

  const active = document.querySelector('.nav-item.active')?.getAttribute('data-view');
  if (active === 'uaf') renderUAFViews(cachedData);
  if (active === 'lora') renderLoraViews(cachedData);
  if (active === 'minion') renderMinionChart();
}

function ndviAsPercent(ndvi) {
  const n = Number(ndvi);
  if (n <= 1 && n >= 0) return Math.round(n * 100);
  return Math.round(n);
}

function updateKPIs(data) {
  const th = getThresholds();
  animateValue('kpi-sensors', 45210 + data.length * 120, 1500);
  animateValue('kpi-area', 88000 + data.length * 400, 1500);

  if (data.length > 0) {
    const avgMos = (data.reduce((a, b) => a + Number(b.mos), 0) / data.length).toFixed(2);
    const avgWat = (data.reduce((a, b) => a + Number(b.humedad), 0) / data.length).toFixed(1);
    document.getElementById('kpi-mos').innerText = avgMos;
    document.getElementById('kpi-water').innerText = avgWat;
  }

  const elLotes = document.getElementById('uaf-kpi-lotes');
  const elNdvi = document.getElementById('uaf-kpi-ndvi');
  const elAlerts = document.getElementById('uaf-kpi-alerts');
  if (elLotes) elLotes.textContent = String(data.length);
  if (data.length && elNdvi) {
    const avgNdvi = data.reduce((a, b) => a + Number(b.ndvi), 0) / data.length;
    elNdvi.textContent = avgNdvi.toFixed(2);
  }
  if (elAlerts) {
    const low = data.filter((d) => Number(d.humedad) < th.humedadMin).length;
    elAlerts.textContent = String(low);
  }
}

function renderUAFTable(data) {
  const tbody = document.getElementById('uaf-table-body');
  if (!tbody) return;
  const th = getThresholds();
  tbody.innerHTML = '';
  data.forEach((l) => {
    const hum = Number(l.humedad);
    const status = hum < th.humedadMin ? 'warning' : 'optimal';
    const msg = hum < th.humedadMin ? 'Alerta hídrica' : 'Sistema estable';
    tbody.innerHTML += `
            <tr>
                <td><strong>${l.id}</strong></td>
                <td>${l.cultivo}</td>
                <td>${hum}%</td>
                <td>${l.ndvi}</td>
                <td><span class="status-badge ${status}">${msg}</span></td>
            </tr>`;
  });
}

function renderUAFViews(data) {
  const detailBody = document.getElementById('uaf-detail-body');
  const prioList = document.getElementById('uaf-priority-list');
  const th = getThresholds();

  if (detailBody) {
    detailBody.innerHTML = '';
    [...data]
      .sort((a, b) => Number(a.humedad) - Number(b.humedad))
      .forEach((l) => {
        const hum = Number(l.humedad);
        const nd = Number(l.ndvi);
        let prio = 'Normal';
        if (hum < th.humedadMin) prio = 'Riego urgente';
        else if (nd < th.ndviMin) prio = 'Revisar vigor';
        detailBody.innerHTML += `
          <tr>
            <td><strong>${l.id}</strong></td>
            <td>${l.cultivo}</td>
            <td>${hum}%</td>
            <td>${l.mos != null ? l.mos : '—'}</td>
            <td>${nd}</td>
            <td><span class="status-badge ${prio === 'Normal' ? 'optimal' : 'warning'}">${prio}</span></td>
          </tr>`;
      });
  }

  if (prioList) {
    const urgent = data
      .map((l) => ({ ...l, hum: Number(l.humedad), nd: Number(l.ndvi) }))
      .filter((l) => l.hum < th.humedadMin || l.nd < th.ndviMin)
      .sort((a, b) => a.hum - b.hum);
    prioList.innerHTML = '';
    if (!urgent.length) {
      prioList.innerHTML = '<li class="priority-item ok">Sin alertas: todos los lotes dentro de umbral.</li>';
    } else {
      urgent.forEach((l) => {
        prioList.innerHTML += `<li class="priority-item warn"><strong>${l.id}</strong> · ${l.cultivo}: humedad ${l.hum}% · NDVI ${l.nd}</li>`;
      });
    }
  }

  const canvas = document.getElementById('uafTrendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (uafTrendChart) uafTrendChart.destroy();

  uafTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map((d) => String(d.id)),
      datasets: [
        {
          label: 'Humedad %',
          data: data.map((d) => d.humedad),
          borderColor: C.teal400,
          backgroundColor: 'rgba(29, 159, 117, 0.12)',
          fill: true,
          tension: 0.35
        },
        {
          label: 'NDVI (×100)',
          data: data.map((d) => ndviAsPercent(d.ndvi)),
          borderColor: C.amber400,
          backgroundColor: 'rgba(239, 159, 39, 0.12)',
          fill: true,
          tension: 0.35
        }
      ]
    },
    options: chartBaseOptions()
  });
}

function renderLoraViews(data) {
  const labels = [];
  const rssiVals = [];
  const tbody = document.getElementById('lora-table-body');
  const bases = ['GW-CAU', 'GW-VLL', 'GW-EJE', 'GW-ZOO'];
  if (tbody) {
    tbody.innerHTML = '';
    data.forEach((lot, i) => {
      const eui = `0080${String(i + 1).padStart(12, '0')}`;
      const zone = bases[i % bases.length];
      const rssi = -85 - (i % 5) * 4 - Math.round(Number(lot.humedad) % 7);
      const bat = 60 + (i * 3) % 35;
      const online = Number(lot.humedad) > 10;
      labels.push(`N${i + 1}`);
      rssiVals.push(rssi);
      tbody.innerHTML += `
        <tr>
          <td><code>${eui}</code></td>
          <td>${zone} · ${lot.id}</td>
          <td>${rssi} dBm</td>
          <td>${bat}%</td>
          <td><span class="status-badge ${online ? 'optimal' : 'warning'}">${online ? 'Online' : 'Degradado'}</span></td>
        </tr>`;
    });
    for (let j = 0; j < 3; j++) {
      const rssi = -92 - j * 2;
      labels.push(`Aux-${j + 1}`);
      rssiVals.push(rssi);
      tbody.innerHTML += `
        <tr>
          <td><code>00AA${String(j).padStart(14, '0')}</code></td>
          <td>Reserva · red</td>
          <td>${rssi} dBm</td>
          <td>78%</td>
          <td><span class="status-badge optimal">Online</span></td>
        </tr>`;
    }
  }

  const onlineEl = document.getElementById('lora-online');
  const rssiEl = document.getElementById('lora-rssi');
  const pktEl = document.getElementById('lora-packets');
  const battEl = document.getElementById('lora-batt');
  if (rssiVals.length && rssiEl) {
    const avg = Math.round(rssiVals.reduce((a, b) => a + b, 0) / rssiVals.length);
    rssiEl.textContent = String(avg);
  }
  if (onlineEl) onlineEl.textContent = String(Math.max(0, data.length + 2));
  if (pktEl) pktEl.textContent = (12400 + data.length * 420).toLocaleString();
  if (battEl) battEl.textContent = String(68 + (data.length % 12));

  const canvas = document.getElementById('loraRssiChart');
  if (!canvas || !labels.length) return;
  const ctx = canvas.getContext('2d');
  if (loraRssiChart) loraRssiChart.destroy();
  const base = chartBaseOptions();
  loraRssiChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.slice(0, 12),
      datasets: [
        {
          label: 'RSSI (dBm)',
          data: rssiVals.slice(0, 12),
          backgroundColor: 'rgba(239, 159, 39, 0.35)',
          borderColor: C.amber600,
          borderWidth: 2,
          borderRadius: 8
        }
      ]
    },
    options: {
      ...base,
      scales: {
        y: { ...base.scales.y, min: -120, max: -70 },
        x: base.scales.x
      }
    }
  });
}

function renderMainChart(data) {
  const canvas = document.getElementById('mainChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (mainChart) mainChart.destroy();

  mainChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map((d) => d.id),
      datasets: [
        {
          label: 'Humedad %',
          data: data.map((d) => d.humedad),
          backgroundColor: 'rgba(29, 159, 117, 0.35)',
          borderColor: C.teal400,
          borderWidth: 2,
          borderRadius: 10
        },
        {
          label: 'Vigor (NDVI ×100)',
          data: data.map((d) => ndviAsPercent(d.ndvi)),
          backgroundColor: 'rgba(239, 159, 39, 0.35)',
          borderColor: C.amber400,
          borderWidth: 2,
          borderRadius: 10
        }
      ]
    },
    options: chartBaseOptions()
  });
}

function renderCarbonChart() {
  const canvas = document.getElementById('carbonChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (carbonChart) carbonChart.destroy();

  carbonChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['2026', '2027', '2028', '2029', '2030', '2031', '2032', '2033', '2034', '2035'],
      datasets: [
        {
          label: 'Proyección secuestro CO₂e (M t)',
          data: [0.1, 0.3, 0.6, 0.9, 1.2, 1.5, 1.7, 1.9, 2.2, 2.5],
          borderColor: C.teal400,
          backgroundColor: 'rgba(29, 159, 117, 0.12)',
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: chartBaseOptions()
  });
}

function renderMinionChart() {
  const canvas = document.getElementById('minionChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (minionChart) minionChart.destroy();

  minionChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Microbioma', 'Patógeno', 'Genotipo', 'Metagenómica'],
      datasets: [
        {
          data: [42, 18, 28, 12],
          backgroundColor: [
            'rgba(29, 159, 117, 0.55)',
            'rgba(239, 68, 68, 0.5)',
            'rgba(59, 130, 246, 0.45)',
            'rgba(239, 159, 39, 0.5)'
          ],
          borderColor: [C.teal400, C.danger, C.info, C.amber400],
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}

function chartBaseOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { grid: { color: 'rgba(211, 209, 199, 0.65)' }, ticks: { color: C.gris400 } },
      x: { grid: { display: false }, ticks: { color: C.gris400 } }
    }
  };
}

async function runDemoDiagnosis() {
  const btn = document.getElementById('btn-gemini-analyze');
  const container = document.getElementById('ai-response-container');
  const th = getThresholds();
  btn.innerHTML = 'Analizando...';
  btn.style.opacity = '0.5';

  await new Promise((r) => setTimeout(r, 1500));

  const countWarning = cachedData.filter((d) => Number(d.humedad) < th.humedadMin).length;
  const lowNdvi = cachedData.filter((d) => Number(d.ndvi) < th.ndviMin).length;
  const avgHum =
    cachedData.length > 0
      ? (cachedData.reduce((a, b) => a + Number(b.humedad), 0) / cachedData.length).toFixed(1)
      : '0';

  container.innerHTML = `
        <div class="insight-card">
            <strong><i class="fa-solid fa-brain"></i> Diagnóstico ALMA (demo)</strong><br><br>
            Lotes de ejemplo: <strong>${cachedData.length}</strong>. Humedad media: <strong>${avgHum}%</strong>.<br><br>
            ${
              countWarning > 0
                ? `<span style="color:${C.danger}">${countWarning} lote(s) por debajo del umbral de humedad (${th.humedadMin}%).</span> Priorizar riego localizado o aspersión inteligente.`
                : `<span style="color:${C.success}">Ningún lote bajo el umbral hídrico configurado.</span>`
            }
            <br><br>
            ${
              lowNdvi > 0
                ? `<span style="color:${C.warning}">${lowNdvi} lote(s) con NDVI bajo referencia (${th.ndviMin}).</span> Revisar nutrición o plagas según UAF.`
                : 'NDVI coherente con escenario regenerativo esperado.'
            }
        </div>`;
  btn.innerHTML = 'Generar diagnóstico';
  btn.style.opacity = '1';
}

function animateValue(id, end, duration) {
  const obj = document.getElementById(id);
  if (!obj) return;
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    obj.innerHTML = Math.floor(progress * end).toLocaleString();
    if (progress < 1) window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
}
