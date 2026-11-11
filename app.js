(() => {
  'use strict';

  const STORAGE_KEY = 'bigpickle.dashboard.v1';
  const DAY_MS = 86400000;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const numberFmt = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const qtyFmt = new Intl.NumberFormat();

  let state = {
    products: [],
    sales: [],
    settings: { currency: '$' },
  };

  /* -------------------------------------------------- helpers */

  const uid = (prefix = 'id') =>
    `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const escapeHtml = (value) =>
    String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));

  const fmtMoney = (value) => `${state.settings.currency}${numberFmt.format(Number(value) || 0)}`;
  const fmtQty = (value) => qtyFmt.format(Number(value) || 0);

  function fmtDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }

  function dayKey(value) {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function shortMoney(value) {
    const symbol = state.settings.currency;
    if (value >= 1000000) return `${symbol}${(value / 1000000).toFixed(1).replace(/\.0$/, '')}m`;
    if (value >= 1000) return `${symbol}${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return `${symbol}${Math.round(value)}`;
  }

  function niceNumber(value) {
    if (value <= 0) return 1;
    const exponent = Math.floor(Math.log10(value));
    const base = Math.pow(10, exponent);
    const fraction = value / base;
    let nice = 10;
    if (fraction <= 1) nice = 1;
    else if (fraction <= 2) nice = 2;
    else if (fraction <= 2.5) nice = 2.5;
    else if (fraction <= 5) nice = 5;
    return nice * base;
  }

  let toastTimer;
  function toast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* -------------------------------------------------- storage */

  function normalizeProduct(raw) {
    const product = raw && typeof raw === 'object' ? raw : {};
    return {
      id: String(product.id || uid('p')),
      name: String(product.name || 'Unnamed product').slice(0, 120),
      sku: String(product.sku || ''),
      category: String(product.category || ''),
      qty: Math.max(0, Math.floor(Number(product.qty) || 0)),
      price: Math.max(0, Number(product.price) || 0),
      reorder: Math.max(0, Math.floor(Number(product.reorder) || 0)),
    };
  }

  function normalizeSale(raw) {
    const sale = raw && typeof raw === 'object' ? raw : {};
    const qty = Math.max(0, Math.floor(Number(sale.qty) || 0));
    const unitPrice = Math.max(0, Number(sale.unitPrice) || 0);
    const total = Number(sale.total);
    const date = new Date(sale.date);

    return {
      id: String(sale.id || uid('s')),
      productId: sale.productId ? String(sale.productId) : '',
      name: String(sale.name || 'Unknown product').slice(0, 120),
      qty,
      unitPrice,
      total: Number.isFinite(total) && total >= 0 ? total : qty * unitPrice,
      date: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
    };
  }

  function applyParsedData(parsed) {
    const data = parsed && typeof parsed === 'object' ? parsed : {};
    state.products = (Array.isArray(data.products) ? data.products : []).map(normalizeProduct);
    state.sales = (Array.isArray(data.sales) ? data.sales : []).map(normalizeSale);
    const currency = data.settings && typeof data.settings === 'object' ? data.settings.currency : '';
    state.settings = {
      currency: typeof currency === 'string' && currency.trim() ? currency.trim().slice(0, 6) : '$',
    };
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Could not save data', error);
      toast('Could not save data in this browser');
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        applyParsedData(JSON.parse(raw));
        return;
      }
    } catch (error) {
      console.warn('Could not load saved data', error);
    }
    seedDemoData();
    save();
  }

  function seedDemoData() {
    const products = [
      { id: 'p-mouse', name: 'Wireless Mouse', sku: 'WM-001', category: 'Electronics', qty: 48, price: 24.99, reorder: 10 },
      { id: 'p-keyboard', name: 'Mechanical Keyboard', sku: 'KB-014', category: 'Electronics', qty: 26, price: 79.99, reorder: 8 },
      { id: 'p-hub', name: 'USB-C Hub', sku: 'HB-220', category: 'Electronics', qty: 9, price: 39.5, reorder: 12 },
      { id: 'p-lamp', name: 'Desk Lamp', sku: 'DL-330', category: 'Home Office', qty: 34, price: 32, reorder: 10 },
      { id: 'p-notebook', name: 'Notebook A5', sku: 'NB-105', category: 'Stationery', qty: 120, price: 6.75, reorder: 25 },
      { id: 'p-bottle', name: 'Insulated Bottle', sku: 'IB-077', category: 'Lifestyle', qty: 15, price: 18.9, reorder: 20 },
      { id: 'p-webcam', name: 'HD Webcam', sku: 'WC-500', category: 'Electronics', qty: 4, price: 54, reorder: 6 },
      { id: 'p-mat', name: 'Standing Desk Mat', sku: 'DM-210', category: 'Home Office', qty: 22, price: 45, reorder: 8 },
    ];

    state.products = products;
    state.sales = [];

    const now = Date.now();
    for (let daysAgo = 6; daysAgo >= 0; daysAgo -= 1) {
      const saleCount = 1 + Math.floor(Math.random() * 4);
      for (let i = 0; i < saleCount; i += 1) {
        const product = products[Math.floor(Math.random() * products.length)];
        const qty = 1 + Math.floor(Math.random() * 3);
        if (product.qty < qty) continue;

        product.qty -= qty;
        const date = new Date(now - daysAgo * DAY_MS);
        date.setHours(9 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60), 0, 0);

        state.sales.push({
          id: uid('s'),
          productId: product.id,
          name: product.name,
          qty,
          unitPrice: product.price,
          total: Number((product.price * qty).toFixed(2)),
          date: date.toISOString(),
        });
      }
    }

    state.sales.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /* -------------------------------------------------- stats */

  function getStats() {
    const units = state.products.reduce((sum, product) => sum + Number(product.qty || 0), 0);
    const stockValue = state.products.reduce(
      (sum, product) => sum + Number(product.qty || 0) * Number(product.price || 0),
      0,
    );
    const revenue = state.sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const lowStock = state.products.filter(
      (product) => Number(product.qty || 0) <= Number(product.reorder || 0),
    ).length;

    return {
      units,
      stockValue,
      revenue,
      lowStock,
      salesCount: state.sales.length,
      productCount: state.products.length,
    };
  }

  /* -------------------------------------------------- render: KPIs */

  function renderKPIs() {
    const stats = getStats();
    $('#kpiUnits').textContent = fmtQty(stats.units);
    $('#kpiUnitsSub').textContent = `${fmtQty(stats.productCount)} product${stats.productCount === 1 ? '' : 's'}`;
    $('#kpiStockValue').textContent = fmtMoney(stats.stockValue);
    $('#kpiStockValueSub').textContent = 'At current unit prices';
    $('#kpiRevenue').textContent = fmtMoney(stats.revenue);
    $('#kpiRevenueSub').textContent = `${fmtQty(stats.salesCount)} sale${stats.salesCount === 1 ? '' : 's'} recorded`;
    $('#kpiLowStock').textContent = fmtQty(stats.lowStock);
    $('#kpiLowStockSub').textContent = stats.lowStock ? 'Needs attention' : 'All levels healthy';
  }

  /* -------------------------------------------------- render: chart */

  function renderChart() {
    const canvas = $('#salesChart');
    if (!canvas) return;

    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      days.push({ key: dayKey(date), date, total: 0 });
    }

    state.sales.forEach((sale) => {
      const row = days.find((day) => day.key === dayKey(sale.date));
      if (row) row.total += Number(sale.total) || 0;
    });

    const total = days.reduce((sum, day) => sum + day.total, 0);
    $('#chartTotal').textContent = fmtMoney(total);
    const hasSales = days.some((day) => day.total > 0);
    $('#chartEmpty').classList.toggle('hidden', hasSales);

    const cssWidth = canvas.clientWidth;
    if (!cssWidth) return;

    const cssHeight = 260;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const pad = { top: 16, right: 10, bottom: 30, left: 50 };
    const plotWidth = Math.max(10, cssWidth - pad.left - pad.right);
    const plotHeight = cssHeight - pad.top - pad.bottom;
    const maxTotal = Math.max(...days.map((day) => day.total), 1);
    const axisMax = niceNumber(maxTotal);
    const font = '11px "Segoe UI", system-ui, sans-serif';

    ctx.font = font;
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= 4; i += 1) {
      const y = pad.top + plotHeight - (plotHeight * i) / 4;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(cssWidth - pad.right, y);
      ctx.stroke();

      ctx.fillStyle = '#6f857a';
      ctx.textAlign = 'right';
      ctx.fillText(shortMoney((axisMax * i) / 4), pad.left - 8, y);
    }

    const slot = plotWidth / days.length;
    const barWidth = Math.min(38, slot * 0.52);
    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotHeight);
    gradient.addColorStop(0, '#a3e635');
    gradient.addColorStop(1, '#34d399');

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    days.forEach((day, index) => {
      const x = pad.left + slot * index + (slot - barWidth) / 2;
      const baseY = pad.top + plotHeight;

      if (day.total > 0) {
        const barHeight = Math.max(3, (day.total / axisMax) * plotHeight);
        const y = baseY - barHeight;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, barWidth, barHeight, [6, 6, 0, 0]);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.fillRect(x, baseY - 2, barWidth, 2);
      }

      ctx.fillStyle = '#6f857a';
      ctx.fillText(
        day.date.toLocaleDateString(undefined, { weekday: 'short' }),
        x + barWidth / 2,
        baseY + 9,
      );
    });
  }

  /* -------------------------------------------------- render: top products */

  function renderTopProducts() {
    const totals = new Map();
    state.sales.forEach((sale) => {
      const name = sale.name || 'Unknown product';
      const current = totals.get(name) || { name, qty: 0, revenue: 0 };
      current.qty += Number(sale.qty) || 0;
      current.revenue += Number(sale.total) || 0;
      totals.set(name, current);
    });

    const rows = Array.from(totals.values())
      .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
      .slice(0, 5);

    const container = $('#topProducts');
    if (!rows.length) {
      container.innerHTML = '<div class="empty" style="margin-top:0"><p class="empty-title">No sales yet</p><p class="empty-sub">Top sellers will appear here.</p></div>';
      return;
    }

    const maxQty = rows[0].qty || 1;
    container.innerHTML = rows
      .map((row, index) => `
        <div class="rank-row">
          <span class="rank">${index + 1}</span>
          <div class="rank-main">
            <div class="rank-top">
              <span class="rank-name">${escapeHtml(row.name)}</span>
              <span class="rank-qty">${fmtQty(row.qty)} sold</span>
            </div>
            <div class="rank-bar"><span style="width:${Math.max(4, (row.qty / maxQty) * 100).toFixed(1)}%"></span></div>
          </div>
        </div>`)
      .join('');
  }

  /* -------------------------------------------------- render: low stock */

  function renderLowStock() {
    const low = state.products
      .filter((product) => Number(product.qty || 0) <= Number(product.reorder || 0))
      .sort((a, b) => (Number(a.qty) / Math.max(1, Number(a.reorder))) - (Number(b.qty) / Math.max(1, Number(b.reorder))));

    $('#lowStockBadge').textContent = fmtQty(low.length);
    const container = $('#lowStockList');

    if (!low.length) {
      const noProducts = !state.products.length;
      container.innerHTML = `
        <div class="empty" style="margin-top:0">
          <p class="empty-title">${noProducts ? 'No products yet' : 'All stocked up'}</p>
          <p class="empty-sub">${noProducts ? 'Add products to start tracking stock levels.' : 'No products are below their reorder level.'}</p>
        </div>`;
      return;
    }

    container.innerHTML = low
      .slice(0, 6)
      .map((product) => {
        const qty = Number(product.qty) || 0;
        const reorder = Number(product.reorder) || 0;
        const badge = qty === 0
          ? '<span class="badge out">Out of stock</span>'
          : '<span class="badge low">Low stock</span>';
        return `
          <div class="alert-row">
            <div>
              <div class="alert-name">${escapeHtml(product.name)}</div>
              <div class="alert-sku">${escapeHtml(product.sku || 'No SKU')} · reorder at ${fmtQty(reorder)}</div>
            </div>
            <div class="alert-meta">
              <span>${fmtQty(qty)} left</span>
              ${badge}
            </div>
          </div>`;
      })
      .join('') + (low.length > 6 ? `<div class="alert-row"><span class="muted">+${low.length - 6} more low-stock item${low.length - 6 === 1 ? '' : 's'}</span></div>` : '');
  }

  /* -------------------------------------------------- render: inventory */

  function getCategories() {
    return Array.from(new Set(
      state.products
        .map((product) => String(product.category || '').trim())
        .filter(Boolean),
    )).sort((a, b) => a.localeCompare(b));
  }

  function renderCategoryFilter() {
    const select = $('#categoryFilter');
    const previous = select.value || 'all';
    const categories = getCategories();
    select.innerHTML = '<option value="all">All categories</option>' +
      categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
    select.value = categories.includes(previous) ? previous : 'all';

    $('#categoryOptions').innerHTML = categories
      .map((category) => `<option value="${escapeHtml(category)}"></option>`)
      .join('');
  }

  function renderInventory() {
    const search = ($('#inventorySearch').value || '').trim().toLowerCase();
    const category = $('#categoryFilter').value || 'all';

    let rows = state.products.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (category !== 'all') rows = rows.filter((product) => product.category === category);
    if (search) {
      rows = rows.filter((product) =>
        [product.name, product.sku, product.category].some((value) =>
          String(value || '').toLowerCase().includes(search),
        ),
      );
    }

    const body = $('#inventoryBody');
    body.innerHTML = rows
      .map((product) => {
        const qty = Number(product.qty) || 0;
        const reorder = Number(product.reorder) || 0;
        const price = Number(product.price) || 0;
        const status = qty === 0
          ? { className: 'out', label: 'Out of stock' }
          : qty <= reorder
            ? { className: 'low', label: 'Low stock' }
            : { className: 'ok', label: 'In stock' };

        return `
          <tr>
            <td>
              <div class="cell-title">${escapeHtml(product.name)}</div>
              <div class="cell-sub">${escapeHtml(product.sku || 'No SKU')}</div>
            </td>
            <td><span class="chip">${escapeHtml(product.category || 'Uncategorized')}</span></td>
            <td class="num">${fmtQty(qty)}</td>
            <td class="num">${fmtMoney(price)}</td>
            <td class="num">${fmtMoney(qty * price)}</td>
            <td><span class="badge ${status.className}">${status.label}</span></td>
            <td>
              <div class="row-actions">
                <button class="icon-btn" type="button" data-action="edit" data-id="${escapeHtml(product.id)}" title="Edit product" aria-label="Edit ${escapeHtml(product.name)}">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
                <button class="icon-btn danger" type="button" data-action="delete" data-id="${escapeHtml(product.id)}" title="Delete product" aria-label="Delete ${escapeHtml(product.name)}">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>
                </button>
              </div>
            </td>
          </tr>`;
      })
      .join('');

    $('#inventoryEmpty').classList.toggle('hidden', rows.length > 0);
    $('#inventoryCount').textContent = `${fmtQty(rows.length)} product${rows.length === 1 ? '' : 's'}`;
  }

  /* -------------------------------------------------- render: sales */

  function renderSales() {
    const search = ($('#salesSearch').value || '').trim().toLowerCase();
    let rows = state.sales.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    if (search) rows = rows.filter((sale) => String(sale.name || '').toLowerCase().includes(search));

    const revenue = rows.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const units = rows.reduce((sum, sale) => sum + Number(sale.qty || 0), 0);

    $('#salesRevenue').textContent = fmtMoney(revenue);
    $('#salesUnits').textContent = fmtQty(units);
    $('#salesCount').textContent = fmtQty(rows.length);

    $('#salesBody').innerHTML = rows
      .map((sale) => `
        <tr>
          <td>${escapeHtml(fmtDate(sale.date))}</td>
          <td>
            <div class="cell-title">${escapeHtml(sale.name || 'Unknown product')}</div>
            <div class="cell-sub">Sale ${escapeHtml(String(sale.id || '').slice(-5))}</div>
          </td>
          <td class="num">${fmtQty(sale.qty)}</td>
          <td class="num">${fmtMoney(sale.unitPrice)}</td>
          <td class="num">${fmtMoney(sale.total)}</td>
          <td>
            <div class="row-actions">
              <button class="icon-btn danger" type="button" data-action="delete-sale" data-id="${escapeHtml(sale.id)}" title="Delete sale" aria-label="Delete sale">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>
              </button>
            </div>
          </td>
        </tr>`)
      .join('');

    $('#salesEmpty').classList.toggle('hidden', rows.length > 0);
  }

  /* -------------------------------------------------- render: all */

  function renderAll() {
    renderKPIs();
    renderCategoryFilter();
    renderInventory();
    renderSales();
    renderTopProducts();
    renderLowStock();
    if (!$('#view-dashboard').classList.contains('hidden')) renderChart();
    updateCurrencySelect();
  }

  function updateCurrencySelect() {
    const select = $('#currencySelect');
    const symbol = state.settings.currency;
    if (!Array.from(select.options).some((option) => option.value === symbol)) {
      const option = document.createElement('option');
      option.value = symbol;
      option.textContent = symbol;
      select.appendChild(option);
    }
    select.value = symbol;
  }

  /* -------------------------------------------------- navigation */

  const VIEW_META = {
    dashboard: { eyebrow: 'Overview', title: 'Dashboard' },
    inventory: { eyebrow: 'Stock control', title: 'Inventory' },
    sales: { eyebrow: 'Transactions', title: 'Sales' },
  };

  function setView(view) {
    $$('.nav-item').forEach((button) => {
      button.classList.toggle('active', button.dataset.view === view);
    });
    $$('.view').forEach((section) => {
      section.classList.toggle('hidden', section.id !== `view-${view}`);
    });

    const meta = VIEW_META[view] || VIEW_META.dashboard;
    $('#pageEyebrow').textContent = meta.eyebrow;
    $('#pageTitle').textContent = meta.title;

    if (view === 'dashboard') requestAnimationFrame(renderChart);
    if (view === 'inventory') renderInventory();
    if (view === 'sales') renderSales();
  }

  /* -------------------------------------------------- modals */

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const focusTarget = modal.querySelector('input:not([type="hidden"]), select, button');
    if (focusTarget) setTimeout(() => focusTarget.focus(), 30);
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('hidden');
    if (!document.querySelector('.modal:not(.hidden)')) document.body.style.overflow = '';
  }

  function openProductModal(product) {
    $('#productForm').reset();
    $('#productId').value = product ? product.id : '';
    $('#productModalTitle').textContent = product ? 'Edit product' : 'Add product';
    $('#productName').value = product ? product.name : '';
    $('#productSku').value = product ? product.sku || '' : '';
    $('#productCategory').value = product ? product.category || '' : '';
    $('#productQty').value = product ? Number(product.qty) || 0 : 0;
    $('#productPrice').value = product ? Number(product.price) || 0 : 0;
    $('#productReorder').value = product ? Number(product.reorder) || 0 : 5;
    openModal('productModal');
  }

  function openSaleModal() {
    if (!state.products.length) {
      toast('Add a product before recording a sale');
      openProductModal();
      return;
    }
    renderSaleOptions();
    $('#saleQty').value = 1;
    updateSalePreview();
    openModal('saleModal');
  }

  function renderSaleOptions() {
    const select = $('#saleProduct');
    const previous = select.value;
    const available = state.products
      .filter((product) => Number(product.qty) > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    select.innerHTML = available.length
      ? available
        .map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)} — ${fmtQty(product.qty)} in stock</option>`)
        .join('')
      : '<option value="">No products in stock</option>';

    if (available.some((product) => product.id === previous)) select.value = previous;

    const submit = $('#saleSubmitBtn');
    submit.disabled = !available.length;
    submit.style.opacity = available.length ? '' : '0.55';
    submit.style.cursor = available.length ? '' : 'not-allowed';
  }

  function updateSalePreview() {
    const product = state.products.find((item) => item.id === $('#saleProduct').value);
    const qtyInput = $('#saleQty');

    if (!product) {
      $('#salePrice').textContent = fmtMoney(0);
      $('#saleStockHint').textContent = '0';
      $('#saleTotal').textContent = fmtMoney(0);
      qtyInput.removeAttribute('max');
      return;
    }

    const stock = Number(product.qty) || 0;
    const price = Number(product.price) || 0;
    const qty = Math.max(1, Math.min(stock, Math.floor(Number(qtyInput.value) || 1)));

    qtyInput.max = String(Math.max(1, stock));
    $('#salePrice').textContent = fmtMoney(price);
    $('#saleStockHint').textContent = `${fmtQty(stock)} available`;
    $('#saleTotal').textContent = fmtMoney(price * qty);
  }

  /* -------------------------------------------------- actions */

  function handleProductSubmit(event) {
    event.preventDefault();

    const id = $('#productId').value;
    const name = $('#productName').value.trim();
    const sku = $('#productSku').value.trim();
    const category = $('#productCategory').value.trim();
    const qty = Math.max(0, Math.floor(Number($('#productQty').value) || 0));
    const price = Math.max(0, Number($('#productPrice').value) || 0);
    const reorder = Math.max(0, Math.floor(Number($('#productReorder').value) || 0));

    if (!name) {
      toast('Product name is required');
      $('#productName').focus();
      return;
    }

    if (id) {
      const product = state.products.find((item) => item.id === id);
      if (!product) return;
      Object.assign(product, { name, sku, category, qty, price, reorder });
      toast(`Updated ${name}`);
    } else {
      state.products.push({ id: uid('p'), name, sku, category, qty, price, reorder });
      toast(`Added ${name}`);
    }

    save();
    closeModal('productModal');
    renderAll();
  }

  function handleSaleSubmit(event) {
    event.preventDefault();

    const product = state.products.find((item) => item.id === $('#saleProduct').value);
    if (!product) {
      toast('Choose a product to sell');
      return;
    }

    const stock = Number(product.qty) || 0;
    const qty = Math.floor(Number($('#saleQty').value) || 0);

    if (qty < 1) {
      toast('Quantity must be at least 1');
      return;
    }
    if (qty > stock) {
      toast(`Only ${fmtQty(stock)} unit${stock === 1 ? '' : 's'} in stock`);
      return;
    }

    const unitPrice = Number(product.price) || 0;
    product.qty = stock - qty;

    state.sales.push({
      id: uid('s'),
      productId: product.id,
      name: product.name,
      qty,
      unitPrice,
      total: Number((unitPrice * qty).toFixed(2)),
      date: new Date().toISOString(),
    });

    save();
    closeModal('saleModal');
    renderAll();
    toast(`Sale recorded — ${fmtMoney(unitPrice * qty)}`);
  }

  function editProduct(id) {
    const product = state.products.find((item) => item.id === id);
    if (product) openProductModal(product);
  }

  function deleteProduct(id) {
    const product = state.products.find((item) => item.id === id);
    if (!product) return;
    const confirmed = window.confirm(`Delete "${product.name}"? Past sales will be kept.`);
    if (!confirmed) return;

    state.products = state.products.filter((item) => item.id !== id);
    save();
    renderAll();
    toast(`Deleted ${product.name}`);
  }

  function resetAllData() {
    const confirmed = window.confirm('Delete all products and sales? This cannot be undone.');
    if (!confirmed) return;

    state.products = [];
    state.sales = [];
    save();
    renderAll();
    toast('All data cleared');
  }

  function loadDemoData() {
    if (state.products.length || state.sales.length) {
      const confirmed = window.confirm('Replace current data with sample data?');
      if (!confirmed) return;
    }

    seedDemoData();
    save();
    renderAll();
    toast('Sample data loaded');
  }

  function deleteSale(id) {
    const sale = state.sales.find((item) => item.id === id);
    if (!sale) return;
    const confirmed = window.confirm(`Delete this sale of ${sale.qty} × "${sale.name}"? The stock will be returned.`);
    if (!confirmed) return;

    const product = state.products.find((item) => item.id === sale.productId);
    if (product) product.qty = (Number(product.qty) || 0) + (Number(sale.qty) || 0);

    state.sales = state.sales.filter((item) => item.id !== id);
    save();
    renderAll();
    toast('Sale deleted and stock restored');
  }

  /* -------------------------------------------------- import / export */

  function exportBackup() {
    const payload = { ...state, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `big-pickle-backup-${dayKey(new Date())}.json`);
    toast('Backup exported');
  }

  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        if (!Array.isArray(parsed.products) || !Array.isArray(parsed.sales)) {
          throw new Error('Invalid backup file');
        }
        if (!window.confirm('Replace all current data with this backup?')) return;

        applyParsedData(parsed);
        save();
        renderAll();
        toast('Backup imported');
      } catch (error) {
        console.warn(error);
        toast('That file is not a valid backup');
      } finally {
        $('#importFile').value = '';
      }
    };
    reader.readAsText(file);
  }

  function exportSalesCsv() {
    if (!state.sales.length) {
      toast('No sales to export yet');
      return;
    }

    const rows = state.sales
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map((sale) => [
        new Date(sale.date).toISOString(),
        sale.name || '',
        sale.qty,
        Number(sale.unitPrice).toFixed(2),
        Number(sale.total).toFixed(2),
        state.settings.currency,
      ]);

    const csv = [['Date', 'Product', 'Quantity', 'Unit price', 'Total', 'Currency'], ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `big-pickle-sales-${dayKey(new Date())}.csv`);
    toast('Sales exported as CSV');
  }

  /* -------------------------------------------------- events */

  function wireEvents() {
    $$('.nav-item').forEach((button) => {
      button.addEventListener('click', () => setView(button.dataset.view));
    });

    $('#addProductBtn').addEventListener('click', () => openProductModal());
    $('#recordSaleBtn').addEventListener('click', openSaleModal);
    $('#productForm').addEventListener('submit', handleProductSubmit);
    $('#saleForm').addEventListener('submit', handleSaleSubmit);

    $('#inventorySearch').addEventListener('input', renderInventory);
    $('#categoryFilter').addEventListener('change', renderInventory);
    $('#salesSearch').addEventListener('input', renderSales);

    $('#inventoryBody').addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      if (button.dataset.action === 'edit') editProduct(button.dataset.id);
      if (button.dataset.action === 'delete') deleteProduct(button.dataset.id);
    });

    $('#salesBody').addEventListener('click', (event) => {
      const button = event.target.closest('[data-action="delete-sale"]');
      if (button) deleteSale(button.dataset.id);
    });

    document.addEventListener('click', (event) => {
      const closeTarget = event.target.closest('[data-close]');
      if (closeTarget) closeModal(closeTarget.dataset.close);

      const goto = event.target.closest('[data-goto]');
      if (goto) setView(goto.dataset.goto);

      if (event.target.closest('[data-add-product]')) openProductModal();
      if (event.target.closest('[data-record-sale]')) openSaleModal();
      if (event.target.closest('[data-load-demo]')) loadDemoData();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      $$('.modal:not(.hidden)').forEach((modal) => closeModal(modal.id));
    });

    $('#saleProduct').addEventListener('change', () => {
      $('#saleQty').value = 1;
      updateSalePreview();
    });

    $('#saleQty').addEventListener('input', () => {
      const max = Number($('#saleQty').max) || Infinity;
      const value = Math.floor(Number($('#saleQty').value) || 0);
      if (value > max) $('#saleQty').value = String(max);
      updateSalePreview();
    });

    $('#currencySelect').addEventListener('change', (event) => {
      state.settings.currency = event.target.value;
      save();
      renderAll();
      toast(`Currency set to ${event.target.value}`);
    });

    $('#exportBtn').addEventListener('click', exportBackup);
    $('#importBtn').addEventListener('click', () => $('#importFile').click());
    $('#resetBtn').addEventListener('click', resetAllData);
    $('#importFile').addEventListener('change', (event) => importBackup(event.target.files[0]));
    $('#exportSalesBtn').addEventListener('click', exportSalesCsv);

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!$('#view-dashboard').classList.contains('hidden')) renderChart();
      }, 120);
    });
  }

  /* -------------------------------------------------- init */

  function init() {
    load();
    wireEvents();
    renderAll();
    setView('dashboard');
  }

  init();
})();
