/* ============================================
   Assignment Tracker — App Logic
   ============================================ */

const STORAGE_KEY = 'assignment-tracker-v1';
const RANGE_KEY = 'assignment-tracker-range-v1';

// Palette for month tabs — cycles if range exceeds palette length
const MONTH_COLORS = [
  '#1F4E78', '#2E75B6', '#5B9BD5', '#70AD47',
  '#FFC000', '#ED7D31', '#C00000', '#7030A0',
  '#2E7D32', '#00838F', '#5E35B1', '#D81B60',
];

// Default range: May 2026 → Dec 2026
const DEFAULT_RANGE = {
  startMonth: 4,   // 0-indexed: 4 = May
  startYear: 2026,
  endMonth: 11,    // 11 = Dec
  endYear: 2026,
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function loadRange() {
  try {
    const raw = localStorage.getItem(RANGE_KEY);
    if (!raw) return { ...DEFAULT_RANGE };
    return JSON.parse(raw);
  } catch (e) {
    return { ...DEFAULT_RANGE };
  }
}

function saveRange() {
  localStorage.setItem(RANGE_KEY, JSON.stringify(range));
}

let range = loadRange();

// Build the MONTHS list from the current range
function buildMonths() {
  const list = [];
  let m = range.startMonth;
  let y = range.startYear;
  let i = 0;
  // Safety cap at 120 months (10 years) so we never loop forever
  while (i < 120) {
    list.push({
      name: `${MONTH_NAMES[m]} ${y}`,
      m,
      y,
      color: MONTH_COLORS[i % MONTH_COLORS.length],
    });
    if (m === range.endMonth && y === range.endYear) break;
    m++;
    if (m > 11) { m = 0; y++; }
    i++;
  }
  return list;
}

let MONTHS = buildMonths();

// Shift the start of the range one month backward
function extendBackward() {
  let m = range.startMonth - 1;
  let y = range.startYear;
  if (m < 0) { m = 11; y--; }
  range.startMonth = m;
  range.startYear = y;
  saveRange();
  MONTHS = buildMonths();
}

// Shift the end of the range one month forward
function extendForward() {
  let m = range.endMonth + 1;
  let y = range.endYear;
  if (m > 11) { m = 0; y++; }
  range.endMonth = m;
  range.endYear = y;
  saveRange();
  MONTHS = buildMonths();
}

// Remove the first month from the range (only if it has no assignments)
function shrinkBackward() {
  if (MONTHS.length <= 1) return { ok: false, reason: 'Cannot remove the last month' };
  const first = MONTHS[0];
  const hasData = assignments.some(a => {
    const mo = monthOfDate(a.assignDate);
    return mo && mo.name === first.name;
  });
  if (hasData) return { ok: false, reason: `${first.name} has assignments — delete them first` };
  let m = range.startMonth + 1;
  let y = range.startYear;
  if (m > 11) { m = 0; y++; }
  range.startMonth = m;
  range.startYear = y;
  saveRange();
  MONTHS = buildMonths();
  return { ok: true, removed: first.name };
}

// Remove the last month from the range (only if it has no assignments)
function shrinkForward() {
  if (MONTHS.length <= 1) return { ok: false, reason: 'Cannot remove the last month' };
  const last = MONTHS[MONTHS.length - 1];
  const hasData = assignments.some(a => {
    const mo = monthOfDate(a.assignDate);
    return mo && mo.name === last.name;
  });
  if (hasData) return { ok: false, reason: `${last.name} has assignments — delete them first` };
  let m = range.endMonth - 1;
  let y = range.endYear;
  if (m < 0) { m = 11; y--; }
  range.endMonth = m;
  range.endYear = y;
  saveRange();
  MONTHS = buildMonths();
  return { ok: true, removed: last.name };
}

// State
let state = {
  view: 'overview',
  month: null,
  search: '',
  filterStatus: '',
  filterPriority: '',
  editingId: null,
};

let assignments = loadData();

// ============================================
// Storage
// ============================================

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load data', e);
    return [];
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
  } catch (e) {
    console.error('Failed to save data', e);
    toast('Could not save — storage may be full');
  }
}

// ============================================
// Helpers
// ============================================

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fmtCurrency(n) {
  if (n == null || isNaN(n)) return '৳0';
  return '৳' + Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s + 'T00:00:00');
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function monthOfDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const m = d.getMonth();
  const y = d.getFullYear();
  return MONTHS.find(mo => mo.m === m && mo.y === y) || null;
}

function daysLeft(submitStr, status) {
  if (!submitStr) return null;
  if (status === 'Complete') return 'done';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(submitStr + 'T00:00:00');
  const diff = Math.round((d - today) / (1000 * 60 * 60 * 24));
  return diff;
}

function daysBadge(value) {
  if (value === null) return '<span class="days normal">—</span>';
  if (value === 'done') return '<span class="days done">✓ Done</span>';
  if (value < 0) return `<span class="days overdue">${value}d overdue</span>`;
  if (value <= 3) return `<span class="days urgent">${value}d left</span>`;
  if (value <= 7) return `<span class="days soon">${value}d left</span>`;
  return `<span class="days normal">${value}d left</span>`;
}

function pillClass(value) {
  return (value || '').toLowerCase().replace(/\s+/g, '-');
}

function statusPill(s) {
  if (!s) return '<span class="pill due">Due</span>';
  return `<span class="pill ${pillClass(s)}">${s}</span>`;
}

function paymentPill(p) {
  if (!p) return '';
  return `<span class="pill ${pillClass(p)}">${p}</span>`;
}

function priorityPill(p) {
  if (!p) return '<span style="color: var(--text-mute);">—</span>';
  return `<span class="pill ${pillClass(p)}">${p}</span>`;
}

function escape(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('is-open');
  // Force reflow to restart animation
  void el.offsetWidth;
  el.classList.add('is-open');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { el.classList.remove('is-open'); }, 2500);
}

// ============================================
// Filtering & sorting
// ============================================

function filteredAssignments(monthName = null) {
  let list = [...assignments];
  if (monthName) {
    list = list.filter(a => {
      const mo = monthOfDate(a.assignDate);
      return mo && mo.name === monthName;
    });
  }
  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter(a =>
      (a.title || '').toLowerCase().includes(q) ||
      (a.notes || '').toLowerCase().includes(q)
    );
  }
  if (state.filterStatus) {
    list = list.filter(a => (a.status || 'Due') === state.filterStatus);
  }
  if (state.filterPriority) {
    list = list.filter(a => a.priority === state.filterPriority);
  }
  // Sort: incomplete first by submission date, then complete
  list.sort((a, b) => {
    const aDone = a.status === 'Complete';
    const bDone = b.status === 'Complete';
    if (aDone !== bDone) return aDone ? 1 : -1;
    return (a.submissionDate || '').localeCompare(b.submissionDate || '');
  });
  return list;
}

function monthStats(monthName) {
  const list = assignments.filter(a => {
    const mo = monthOfDate(a.assignDate);
    return mo && mo.name === monthName;
  });
  const total = list.length;
  const completed = list.filter(a => a.status === 'Complete').length;
  const pending = list.filter(a => a.status !== 'Complete').length;
  const earned = list
    .filter(a => a.payment === 'Paid')
    .reduce((s, a) => s + (Number(a.price) || 0), 0);
  const outstanding = list
    .filter(a => a.payment !== 'Paid')
    .reduce((s, a) => s + (Number(a.price) || 0), 0);
  return {
    total,
    completed,
    pending,
    completionRate: total ? completed / total : 0,
    earned,
    outstanding,
    totalValue: earned + outstanding,
  };
}

function overallStats() {
  const total = assignments.length;
  const completed = assignments.filter(a => a.status === 'Complete').length;
  const earned = assignments.filter(a => a.payment === 'Paid')
    .reduce((s, a) => s + (Number(a.price) || 0), 0);
  const outstanding = assignments.filter(a => a.payment !== 'Paid')
    .reduce((s, a) => s + (Number(a.price) || 0), 0);
  return {
    total,
    completed,
    completionRate: total ? completed / total : 0,
    earned,
    outstanding,
  };
}

// ============================================
// Rendering
// ============================================

const view = document.getElementById('view');
let charts = {};

function render() {
  // Destroy any existing charts before re-render
  Object.values(charts).forEach(c => c && c.destroy());
  charts = {};

  if (state.view === 'overview') renderOverview();
  else if (state.view === 'all') renderAll();
  else if (state.view === 'month') renderMonth(state.month);

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('active');
    const v = el.dataset.view;
    if (v === state.view) {
      if (v === 'month' && el.dataset.month === state.month) el.classList.add('active');
      else if (v !== 'month') el.classList.add('active');
    }
  });
}

function renderOverview() {
  const stats = overallStats();
  const monthStatsList = MONTHS.map(m => ({ ...m, ...monthStats(m.name) }));

  view.innerHTML = `
    <header class="page-header">
      <div class="page-eyebrow"><span class="dot"></span> Workspace</div>
      <h1 class="page-title">Overview</h1>
      <p class="page-subtitle">Your assignments and earnings across ${MONTHS.length === 1 ? 'one month' : `all ${MONTHS.length} months`}. Click any month below to drill in.</p>
    </header>

    <section class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">Total Assignments</div>
        <div class="kpi-value blue">${stats.total}</div>
        <div class="kpi-foot">${stats.completed} completed</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Completion Rate</div>
        <div class="kpi-value">${(stats.completionRate * 100).toFixed(1)}%</div>
        <div class="kpi-foot">${stats.total - stats.completed} pending</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Total Earned</div>
        <div class="kpi-value green">${fmtCurrency(stats.earned)}</div>
        <div class="kpi-foot">received</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Outstanding</div>
        <div class="kpi-value red">${fmtCurrency(stats.outstanding)}</div>
        <div class="kpi-foot">awaiting payment</div>
      </div>
    </section>

    <section class="charts-grid">
      <div class="chart-card">
        <h3>Earnings vs Outstanding</h3>
        <div class="chart-wrap"><canvas id="chart-bar"></canvas></div>
      </div>
      <div class="chart-card">
        <h3>Completion Rate Trend</h3>
        <div class="chart-wrap"><canvas id="chart-line"></canvas></div>
      </div>
    </section>

    <h2 class="section-title">Monthly Breakdown <span class="count">${MONTHS.length} months</span></h2>
    <table class="rollup-table">
      <thead>
        <tr>
          <th>Month</th>
          <th class="num">Total</th>
          <th class="num">Completed</th>
          <th class="num">Pending</th>
          <th class="num">Completion</th>
          <th class="num">Earned</th>
          <th class="num">Outstanding</th>
          <th class="num">Total Value</th>
        </tr>
      </thead>
      <tbody>
        ${monthStatsList.map(m => `
          <tr data-month="${m.name}">
            <td class="month-cell">
              <span class="nav-dot" style="--c:${m.color}"></span>${m.name}
            </td>
            <td class="num">${m.total}</td>
            <td class="num">${m.completed}</td>
            <td class="num">${m.pending}</td>
            <td class="num">${(m.completionRate * 100).toFixed(1)}%</td>
            <td class="num">${fmtCurrency(m.earned)}</td>
            <td class="num">${fmtCurrency(m.outstanding)}</td>
            <td class="num">${fmtCurrency(m.totalValue)}</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td>TOTAL (${MONTHS.length} ${MONTHS.length === 1 ? 'MONTH' : 'MONTHS'})</td>
          <td class="num">${stats.total}</td>
          <td class="num">${stats.completed}</td>
          <td class="num">${stats.total - stats.completed}</td>
          <td class="num">${(stats.completionRate * 100).toFixed(1)}%</td>
          <td class="num">${fmtCurrency(stats.earned)}</td>
          <td class="num">${fmtCurrency(stats.outstanding)}</td>
          <td class="num">${fmtCurrency(stats.earned + stats.outstanding)}</td>
        </tr>
      </tfoot>
    </table>
  `;

  // Wire up month-row clicks
  view.querySelectorAll('.rollup-table tbody tr').forEach(row => {
    row.addEventListener('click', () => {
      state.view = 'month';
      state.month = row.dataset.month;
      render();
    });
  });

  // Build charts
  buildCharts(monthStatsList);
}

function buildCharts(monthStatsList) {
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = '#6b6b66';
  Chart.defaults.borderColor = '#ececea';

  const labels = monthStatsList.map(m => m.name.split(' ')[0]);

  // Bar chart
  const barCtx = document.getElementById('chart-bar');
  if (barCtx) {
    charts.bar = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Earned',
            data: monthStatsList.map(m => m.earned),
            backgroundColor: '#448361',
            borderRadius: 4,
          },
          {
            label: 'Outstanding',
            data: monthStatsList.map(m => m.outstanding),
            backgroundColor: '#d44c47',
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, padding: 14 } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${fmtCurrency(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            grid: { color: '#ececea' },
            ticks: {
              callback: (v) => '৳' + (v >= 1000 ? (v / 1000) + 'k' : v),
            },
          },
        },
      },
    });
  }

  // Line chart
  const lineCtx = document.getElementById('chart-line');
  if (lineCtx) {
    charts.line = new Chart(lineCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Completion Rate',
          data: monthStatsList.map(m => (m.completionRate * 100).toFixed(1)),
          borderColor: '#2383e2',
          backgroundColor: 'rgba(35, 131, 226, 0.08)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#2383e2',
          pointRadius: 4,
          pointHoverRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => `${ctx.parsed.y}%` },
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            max: 100,
            grid: { color: '#ececea' },
            ticks: { callback: (v) => v + '%' },
          },
        },
      },
    });
  }
}

function renderAll() {
  const list = filteredAssignments();
  view.innerHTML = `
    <header class="page-header">
      <div class="page-eyebrow"><span class="dot"></span> All Records</div>
      <h1 class="page-title">All Assignments</h1>
      <p class="page-subtitle">Every assignment in one place. Use search or filters to narrow down. Each row routes automatically to its month by Assign Date.</p>
    </header>
    ${toolbarHTML(true)}
    ${tableHTML(list, true)}
  `;
  wireToolbar();
  wireTableRows();
}

function renderMonth(monthName) {
  const list = filteredAssignments(monthName);
  const month = MONTHS.find(m => m.name === monthName);
  const stats = monthStats(monthName);

  view.innerHTML = `
    <header class="page-header">
      <div class="page-eyebrow">
        <span class="dot" style="background:${month.color}"></span>
        Monthly View
      </div>
      <h1 class="page-title">${monthName}</h1>
      <p class="page-subtitle">${stats.total} assignments · ${fmtCurrency(stats.earned)} earned · ${fmtCurrency(stats.outstanding)} outstanding</p>
    </header>

    <section class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">Total</div>
        <div class="kpi-value blue">${stats.total}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Completed</div>
        <div class="kpi-value green">${stats.completed}</div>
        <div class="kpi-foot">${(stats.completionRate * 100).toFixed(1)}% rate</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Earned</div>
        <div class="kpi-value green">${fmtCurrency(stats.earned)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Outstanding</div>
        <div class="kpi-value red">${fmtCurrency(stats.outstanding)}</div>
      </div>
    </section>

    ${toolbarHTML(false, monthName)}
    ${tableHTML(list, false)}
  `;
  wireToolbar(monthName);
  wireTableRows();
}

function toolbarHTML(showMonthCol, prefillMonth = null) {
  return `
    <div class="toolbar">
      <div class="toolbar-left">
        <input type="text" class="search-input" id="search" placeholder="Search title or notes…" value="${escape(state.search)}" />
        <select class="filter-select" id="filter-status">
          <option value="">All statuses</option>
          ${['Due', 'In Progress', 'Revision', 'Complete'].map(s => `
            <option value="${s}" ${state.filterStatus === s ? 'selected' : ''}>${s}</option>
          `).join('')}
        </select>
        <select class="filter-select" id="filter-priority">
          <option value="">All priorities</option>
          ${['High', 'Medium', 'Low'].map(p => `
            <option value="${p}" ${state.filterPriority === p ? 'selected' : ''}>${p}</option>
          `).join('')}
        </select>
      </div>
      <div class="toolbar-right">
        <button class="btn primary" id="btn-new">
          <span class="plus">+</span> New Assignment
        </button>
      </div>
    </div>
  `;
}

function tableHTML(list, showMonthCol) {
  if (list.length === 0) {
    return `
      <div class="empty">
        <div class="icon">◌</div>
        <h3>No assignments yet</h3>
        <p>Click <strong>+ New Assignment</strong> to add your first entry.</p>
      </div>
    `;
  }
  return `
    <table class="assign-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Title</th>
          <th>Assign</th>
          <th>Submit</th>
          <th>Days</th>
          <th>Priority</th>
          ${showMonthCol ? '<th>Month</th>' : ''}
          <th class="num">Price</th>
          <th>Status</th>
          <th>Payment</th>
          <th>Paid On</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${list.map((a, i) => {
          const dl = daysLeft(a.submissionDate, a.status);
          const mo = monthOfDate(a.assignDate);
          return `
            <tr data-id="${a.id}">
              <td class="sn">${i + 1}</td>
              <td class="title">${escape(a.title)}</td>
              <td class="date">${fmtDate(a.assignDate)}</td>
              <td class="date">${fmtDate(a.submissionDate)}</td>
              <td>${daysBadge(dl)}</td>
              <td>${priorityPill(a.priority)}</td>
              ${showMonthCol ? `<td class="date">${mo ? mo.name : '—'}</td>` : ''}
              <td class="num">${fmtCurrency(a.price)}</td>
              <td>${statusPill(a.status)}</td>
              <td>${paymentPill(a.payment)}</td>
              <td class="date">${fmtDate(a.paymentReceivedDate)}</td>
              <td class="notes-cell" title="${escape(a.notes)}">${escape(a.notes) || '—'}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function wireToolbar(monthContext = null) {
  const search = document.getElementById('search');
  const fStatus = document.getElementById('filter-status');
  const fPriority = document.getElementById('filter-priority');
  const btnNew = document.getElementById('btn-new');

  if (search) {
    search.addEventListener('input', () => {
      state.search = search.value;
      const list = filteredAssignments(monthContext);
      // Replace table only
      const tbl = view.querySelector('.assign-table, .empty');
      if (tbl) {
        const replacement = document.createElement('div');
        replacement.innerHTML = tableHTML(list, !monthContext);
        tbl.replaceWith(replacement.firstElementChild);
        wireTableRows();
      }
    });
  }

  if (fStatus) {
    fStatus.addEventListener('change', () => {
      state.filterStatus = fStatus.value;
      render();
    });
  }

  if (fPriority) {
    fPriority.addEventListener('change', () => {
      state.filterPriority = fPriority.value;
      render();
    });
  }

  if (btnNew) {
    btnNew.addEventListener('click', () => openModal());
  }
}

function wireTableRows() {
  view.querySelectorAll('.assign-table tbody tr').forEach(row => {
    row.addEventListener('click', () => {
      openModal(row.dataset.id);
    });
  });
}

// ============================================
// Modal
// ============================================

const modal = document.getElementById('modal');
const modalForm = document.getElementById('modal-form');
const modalTitle = document.getElementById('modal-title');
const modalDelete = document.getElementById('modal-delete');

function openModal(id = null) {
  state.editingId = id;
  modalTitle.textContent = id ? 'Edit Assignment' : 'New Assignment';
  modalDelete.hidden = !id;

  const a = id ? assignments.find(x => x.id === id) : null;

  document.getElementById('f-title').value = a?.title || '';
  document.getElementById('f-assign').value = a?.assignDate || '';
  document.getElementById('f-submit').value = a?.submissionDate || '';
  document.getElementById('f-priority').value = a?.priority || '';
  document.getElementById('f-price').value = a?.price ?? '';
  document.getElementById('f-status').value = a?.status || 'Due';
  document.getElementById('f-payment').value = a?.payment || 'Due';
  document.getElementById('f-paid-date').value = a?.paymentReceivedDate || '';
  document.getElementById('f-notes').value = a?.notes || '';

  modal.classList.add('is-open');
  setTimeout(() => document.getElementById('f-title').focus(), 50);
}

function closeModal() {
  modal.classList.remove('is-open');
  state.editingId = null;
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
});

modalForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const assign = document.getElementById('f-assign').value;
  const submit = document.getElementById('f-submit').value;
  const paid = document.getElementById('f-paid-date').value;

  // Date validations
  if (assign && submit && submit < assign) {
    toast('Submission date must be on or after assign date');
    return;
  }
  if (assign && paid && paid < assign) {
    toast('Payment date must be on or after assign date');
    return;
  }

  const data = {
    id: state.editingId || uid(),
    title: document.getElementById('f-title').value.trim(),
    assignDate: assign,
    submissionDate: submit,
    priority: document.getElementById('f-priority').value,
    price: parseFloat(document.getElementById('f-price').value) || 0,
    status: document.getElementById('f-status').value,
    payment: document.getElementById('f-payment').value,
    paymentReceivedDate: paid,
    notes: document.getElementById('f-notes').value.trim(),
  };

  if (state.editingId) {
    const idx = assignments.findIndex(x => x.id === state.editingId);
    assignments[idx] = data;
    toast('Saved');
  } else {
    assignments.push(data);
    toast('Added');
  }

  saveData();
  closeModal();
  render();
});

modalDelete.addEventListener('click', () => {
  if (!state.editingId) return;
  if (!confirm('Delete this assignment? This cannot be undone.')) return;
  assignments = assignments.filter(a => a.id !== state.editingId);
  saveData();
  closeModal();
  toast('Deleted');
  render();
});

// ============================================
// Nav wiring
// ============================================

function renderMonthNav() {
  const container = document.getElementById('month-nav');
  if (!container) return;
  container.innerHTML = MONTHS.map(m => `
    <button class="nav-item" data-view="month" data-month="${m.name}">
      <span class="nav-dot" style="--c:${m.color}"></span>${m.name}
    </button>
  `).join('');

  // Update sidebar subtitle to reflect current range
  const sub = document.getElementById('sidebar-sub');
  if (sub) {
    if (MONTHS.length === 1) {
      sub.textContent = `Assignments · ${MONTHS[0].name}`;
    } else {
      sub.textContent = `Assignments · ${MONTHS[0].name} – ${MONTHS[MONTHS.length - 1].name}`;
    }
  }

  // Wire up clicks
  container.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      state.view = 'month';
      state.month = btn.dataset.month;
      state.search = '';
      state.filterStatus = '';
      state.filterPriority = '';
      render();
    });
  });
}

// Wire static nav (Overview, All Assignments)
document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    state.view = btn.dataset.view;
    state.month = btn.dataset.month || null;
    state.search = '';
    state.filterStatus = '';
    state.filterPriority = '';
    render();
  });
});

// Month range buttons
document.getElementById('btn-add-back').addEventListener('click', () => {
  extendBackward();
  renderMonthNav();
  toast(`Added ${MONTHS[0].name}`);
  render();
});

document.getElementById('btn-add-forward').addEventListener('click', () => {
  extendForward();
  renderMonthNav();
  toast(`Added ${MONTHS[MONTHS.length - 1].name}`);
  render();
});

document.getElementById('btn-shrink-back').addEventListener('click', () => {
  const result = shrinkBackward();
  if (result.ok) {
    // If user was viewing the removed month, jump back to Overview
    if (state.view === 'month' && state.month === result.removed) {
      state.view = 'overview';
      state.month = null;
    }
    renderMonthNav();
    toast(`Removed ${result.removed}`);
    render();
  } else {
    toast(result.reason);
  }
});

document.getElementById('btn-shrink-forward').addEventListener('click', () => {
  const result = shrinkForward();
  if (result.ok) {
    if (state.view === 'month' && state.month === result.removed) {
      state.view = 'overview';
      state.month = null;
    }
    renderMonthNav();
    toast(`Removed ${result.removed}`);
    render();
  } else {
    toast(result.reason);
  }
});

// ============================================
// CSV import / export
// ============================================

document.getElementById('btn-export').addEventListener('click', () => {
  if (assignments.length === 0) {
    toast('Nothing to export');
    return;
  }
  const headers = ['title', 'assignDate', 'submissionDate', 'priority', 'price', 'status', 'payment', 'paymentReceivedDate', 'notes'];
  const rows = assignments.map(a =>
    headers.map(h => {
      let v = a[h] ?? '';
      v = String(v).replace(/"/g, '""');
      if (/[",\n]/.test(v)) v = `"${v}"`;
      return v;
    }).join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const date = new Date().toISOString().slice(0, 10);
  link.download = `assignment-tracker-${date}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast(`Exported ${assignments.length} assignments`);
});

document.getElementById('btn-import').addEventListener('click', () => {
  document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      toast('CSV is empty');
      return;
    }
    const headers = parseCSVLine(lines[0]);
    const imported = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const obj = { id: uid() };
      headers.forEach((h, idx) => {
        const v = values[idx] || '';
        obj[h] = h === 'price' ? (parseFloat(v) || 0) : v;
      });
      if (obj.title) imported.push(obj);
    }
    if (!confirm(`Import ${imported.length} assignments? This will REPLACE all current data.`)) return;
    assignments = imported;
    saveData();
    render();
    toast(`Imported ${imported.length} assignments`);
  } catch (err) {
    console.error(err);
    toast('Could not parse CSV');
  }
  e.target.value = '';
});

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { result.push(current); current = ''; }
      else current += ch;
    }
  }
  result.push(current);
  return result;
}

document.getElementById('btn-clear').addEventListener('click', () => {
  if (assignments.length === 0) {
    toast('Already empty');
    return;
  }
  if (!confirm(`Delete all ${assignments.length} assignments? This cannot be undone. Consider exporting first.`)) return;
  assignments = [];
  saveData();
  render();
  toast('All data cleared');
});

// ============================================
// Init
// ============================================

renderMonthNav();
render();
