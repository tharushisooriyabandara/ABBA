(function () {
  var branch = sessionStorage.getItem('abba_branch');
  var branchName = sessionStorage.getItem('abba_branchName');

  if (!branch) {
    window.location.href = 'index.html';
    return;
  }

  var displayName = branchName || branch.charAt(0).toUpperCase() + branch.slice(1);
  var elMain = document.getElementById('branchNameMain');
  if (elMain) elMain.textContent = displayName;

  var logoutBtn = document.querySelector('.btn--outline');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      sessionStorage.removeItem('abba_branch');
      sessionStorage.removeItem('abba_branchName');
      sessionStorage.removeItem('abba_admin');
    });
  }

  var supabase = null;
  if (typeof ABBA_CONFIG !== 'undefined' && ABBA_CONFIG.supabaseUrl && ABBA_CONFIG.supabaseAnonKey && typeof window.supabase !== 'undefined') {
    try {
      supabase = window.supabase.createClient(ABBA_CONFIG.supabaseUrl, ABBA_CONFIG.supabaseAnonKey);
    } catch (e) {}
  }

  var isAdmin = sessionStorage.getItem('abba_admin') === 'true';
  var allOrders = [];
  var orderHistoryPage = 1;
  var ORDER_PAGE_SIZE = 8;
  var EMPLOYEE_PAGE_SIZE = 5;
  var employeePage = 1;
  var LEAVE_REPORT_PAGE_SIZE = 10;
  var leaveReportPage = 1;

  var branchNames = { panadura: 'Panadura', nugegoda: 'Nugegoda', piliyandala: 'Piliyandala' };

  var panelTitles = {
    'order-create': 'New customer order',
    'order-history': 'Order history',
    'sales-report': 'Sales report',
    'employees': 'Employee management',
    'leave-report': 'Leave report'
  };
  var panelSubtitles = {
    'order-create': 'Create a new customer order',
    'order-history': 'View all order history orders',
    'sales-report': 'Revenue and sales by branch',
    'employees': 'Add, edit, or remove employees',
    'leave-report': 'Employees on leave by branch'
  };
  function showPanel(panelId) {
    var titleEl = document.getElementById('homePanelTitle');
    var subEl = document.getElementById('homePanelTitleSub');
    var contentHeadingEl = document.getElementById('homeContentHeading');
    if (titleEl && panelTitles[panelId]) titleEl.textContent = panelTitles[panelId];
    if (subEl && panelSubtitles[panelId]) subEl.textContent = panelSubtitles[panelId];
    if (contentHeadingEl && panelTitles[panelId]) contentHeadingEl.textContent = panelTitles[panelId];
    var panels = document.querySelectorAll('.home-panel');
    var links = document.querySelectorAll('.home-nav__link');
    panels.forEach(function (p) {
      p.classList.toggle('home-panel--hidden', p.id !== 'panel-' + panelId);
    });
    links.forEach(function (a) {
      var isActive = (a.getAttribute('data-panel') || '') === panelId;
      a.classList.toggle('home-nav__link--active', isActive);
    });
    if (panelId === 'order-history' || panelId === 'sales-report') loadOrders();
    if (panelId === 'employees') loadEmployees();
    if (panelId === 'leave-report') {
      loadEmployees();
      renderLeaveReport();
    }
  }
  document.querySelectorAll('.home-nav__link').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var panel = link.getAttribute('data-panel');
      if (panel === 'order-create') {
        if (orderIdEl) orderIdEl.value = '';
        if (orderFormTitle) orderFormTitle.textContent = 'New customer order';
        var titleSubEl = document.getElementById('homePanelTitleSub');
        if (titleSubEl) titleSubEl.textContent = 'Create a new customer order';
        var contentHeadingEl = document.getElementById('homeContentHeading');
        if (contentHeadingEl) contentHeadingEl.textContent = 'New customer order';
        if (orderFormSubmitBtn) orderFormSubmitBtn.textContent = 'Save order';
        setNewOrderIdDisplay();
        if (orderForm) orderForm.reset();
        setOrderFormBranchDefault();
        updateOrderFormRemaining();
      }
      if (panel) showPanel(panel);
    });
  });

  // Branch dropdown: always visible and enabled. Admin = default Panadura. Non-admin = default their own branch, can change to another if needed.
  var orderFormBranchField = document.getElementById('orderFormBranchField');
  var orderBranchSelect = document.getElementById('orderBranch');
  if (orderFormBranchField) orderFormBranchField.hidden = false;
  function setOrderFormBranchDefault() {
    if (!orderBranchSelect) return;
    orderBranchSelect.disabled = false;
    if (isAdmin) {
      orderBranchSelect.value = 'panadura';
    } else {
      orderBranchSelect.value = branch;
    }
  }
  setOrderFormBranchDefault();
  var navEmployeesWrap = document.getElementById('nav-employees-wrap');
  if (isAdmin && navEmployeesWrap) navEmployeesWrap.hidden = false;
  var navLeaveReportWrap = document.getElementById('nav-leave-report-wrap');
  if (isAdmin && navLeaveReportWrap) navLeaveReportWrap.hidden = false;

  function getBranchKey(row) {
    return (row.branch_name || row.branch || '').toString().trim() || '—';
  }
  function getAmount(row) {
    return row.total_amount != null ? Number(row.total_amount) : (row.totalAmount != null ? Number(row.totalAmount) : 0);
  }
  function getAdvance(row) {
    return row.advance != null ? Number(row.advance) : 0;
  }
  function getOrderRemaining(row) {
    if ((row.status || '').toLowerCase() === 'returned' && row.paid_full_on_return === true) return 0;
    return Math.max(0, getAmount(row) - getAdvance(row));
  }

  function filterOrdersForStaff(orders) {
    if (isAdmin) return orders;
    return orders.filter(function (o) {
      return getBranchKey(o) === displayName;
    });
  }

  function renderSalesByBranch(orders) {
    var fromEl = document.getElementById('salesReportFrom');
    var toEl = document.getElementById('salesReportTo');
    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    if (fromEl && !fromEl.value) fromEl.value = todayStr;
    if (toEl && !toEl.value) toEl.value = todayStr;
    var fromVal = (fromEl && fromEl.value) ? fromEl.value : '';
    var toVal = (toEl && toEl.value) ? toEl.value : '';
    var base = isAdmin ? (orders || []) : filterOrdersForStaff(orders || []);
    var list = base;
    if (fromVal || toVal) {
      list = base.filter(function (o) {
        var orderDate = o.created_at || o.date;
        if (!orderDate) return false;
        var d = new Date(orderDate);
        var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
        var dateStr = y + '-' + m + '-' + day;
        if (fromVal && dateStr < fromVal) return false;
        if (toVal && dateStr > toVal) return false;
        return true;
      });
    }
    var totalOrders = list.length;
    var totalRevenue = 0;
    var collected = 0;
    var pendingRevenue = 0;
    for (var i = 0; i < list.length; i++) {
      totalRevenue += getAmount(list[i]);
      collected += getAdvance(list[i]);
      pendingRevenue += getOrderRemaining(list[i]);
    }

    var totalOrdersEl = document.getElementById('salesTotalOrders');
    var totalRevenueEl = document.getElementById('salesTotalRevenue');
    var collectedEl = document.getElementById('salesCollected');
    var pendingEl = document.getElementById('salesPendingRevenue');
    if (totalOrdersEl) totalOrdersEl.textContent = totalOrders;
    if (totalRevenueEl) totalRevenueEl.textContent = formatNumber(totalRevenue) + ' LKR';
    if (collectedEl) collectedEl.textContent = formatNumber(collected) + ' LKR';
    if (pendingEl) pendingEl.textContent = formatNumber(pendingRevenue) + ' LKR';

    var byBranch = {};
    for (var k = 0; k < list.length; k++) {
      var key = getBranchKey(list[k]);
      if (!byBranch[key]) byBranch[key] = { count: 0, total: 0, collected: 0, pending: 0 };
      byBranch[key].count += 1;
      byBranch[key].total += getAmount(list[k]);
      byBranch[key].collected += getAdvance(list[k]);
      byBranch[key].pending += getOrderRemaining(list[k]);
    }
    var branches = Object.keys(byBranch).sort();
    var branchGridEl = document.getElementById('salesBranchGrid');
    if (branchGridEl) {
      if (branches.length === 0) {
        branchGridEl.innerHTML = '<p class="sales-branch-grid-empty">No sales data yet.</p>';
      } else {
        var html = '';
        for (var b = 0; b < branches.length; b++) {
          var name = branches[b];
          var data = byBranch[name];
          html += '<div class="sales-branch-card">' +
            '<span class="sales-branch-card__name">' + escapeHtml(name) + '</span>' +
            '<div class="sales-branch-card__row"><span class="sales-branch-card__label">Orders</span><span class="sales-branch-card__value">' + data.count + '</span></div>' +
            '<div class="sales-branch-card__row"><span class="sales-branch-card__label">Revenue</span><span class="sales-branch-card__value">' + formatNumber(data.total) + ' LKR</span></div>' +
            '<div class="sales-branch-card__row"><span class="sales-branch-card__label">Collected</span><span class="sales-branch-card__value">' + formatNumber(data.collected) + ' LKR</span></div>' +
            '<div class="sales-branch-card__row"><span class="sales-branch-card__label">Pending</span><span class="sales-branch-card__value">' + formatNumber(data.pending) + ' LKR</span></div>' +
            '</div>';
        }
        branchGridEl.innerHTML = html;
      }
    }
  }

  function getOrderHistoryFiltered() {
    var list = isAdmin ? (allOrders || []) : filterOrdersForStaff(allOrders || []);
    var fromEl = document.getElementById('orderHistoryFrom');
    var toEl = document.getElementById('orderHistoryTo');
    var statusEl = document.getElementById('orderHistoryStatus');
    var searchEl = document.getElementById('orderHistorySearch');
    var fromVal = fromEl && fromEl.value ? fromEl.value : '';
    var toVal = toEl && toEl.value ? toEl.value : '';
    var statusVal = (statusEl && statusEl.value) ? statusEl.value.trim().toLowerCase() : '';
    var searchVal = (searchEl && searchEl.value) ? searchEl.value.trim().toLowerCase() : '';
    return list.filter(function (row) {
      var orderDate = row.created_at || row.date;
      if (orderDate) {
        var d = new Date(orderDate);
        var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
        var dateStr = y + '-' + m + '-' + day;
        if (fromVal && dateStr < fromVal) return false;
        if (toVal && dateStr > toVal) return false;
      } else if (fromVal || toVal) return false;
      if (statusVal) {
        var rowStatus = (row.status || 'pending').toLowerCase();
        if (rowStatus !== statusVal) return false;
      }
      if (searchVal) {
        var orderNum = formatOrderNumber(row.order_number);
        var customer = (row.customer_name || row.customerName || '').toLowerCase();
        var phone = (row.customer_phone || row.customerPhone || '').toLowerCase();
        var details = (row.order_details || row.orderDetails || '').toLowerCase();
        var branchStr = (row.branch_name || row.branch || '').toLowerCase();
        var match = orderNum.toLowerCase().indexOf(searchVal) !== -1 ||
          customer.indexOf(searchVal) !== -1 ||
          phone.indexOf(searchVal) !== -1 ||
          details.indexOf(searchVal) !== -1 ||
          branchStr.indexOf(searchVal) !== -1;
        if (!match) return false;
      }
      return true;
    });
  }

  function renderOrderHistory(orders) {
    var tbody = document.getElementById('orderHistoryBody');
    var emptyEl = document.getElementById('orderHistoryEmpty');
    var tableEl = document.getElementById('orderHistoryTable');
    var paginationEl = document.getElementById('orderHistoryPagination');
    if (!tbody) return;
    tbody.innerHTML = '';
    var list = orders || [];
    var total = list.length;
    var totalPages = Math.max(1, Math.ceil(total / ORDER_PAGE_SIZE));
    if (orderHistoryPage > totalPages) orderHistoryPage = totalPages;
    var start = (orderHistoryPage - 1) * ORDER_PAGE_SIZE;
    var pageList = list.slice(start, start + ORDER_PAGE_SIZE);
    if (list.length === 0) {
      if (emptyEl) {
        var hasFilter = (document.getElementById('orderHistoryFrom') && document.getElementById('orderHistoryFrom').value) ||
          (document.getElementById('orderHistoryTo') && document.getElementById('orderHistoryTo').value) ||
          (document.getElementById('orderHistoryStatus') && document.getElementById('orderHistoryStatus').value) ||
          (document.getElementById('orderHistorySearch') && document.getElementById('orderHistorySearch').value.trim());
        emptyEl.textContent = hasFilter ? 'No orders match the filters.' : 'No orders yet.';
        emptyEl.style.display = 'block';
      }
      if (tableEl) tableEl.style.display = 'none';
      if (paginationEl) paginationEl.innerHTML = '';
    } else {
      if (emptyEl) emptyEl.style.display = 'none';
      if (tableEl) tableEl.style.display = 'table';
      for (var i = 0; i < pageList.length; i++) {
        var row = pageList[i];
        var rowId = row.id || row.orderId || 'row-' + i;
        var totalAmt = row.total_amount != null ? Number(row.total_amount) : (row.totalAmount != null ? Number(row.totalAmount) : 0);
        var advanceAmt = row.advance != null ? Number(row.advance) : 0;
        var status = (row.status || 'pending').toLowerCase();
        var paidFullOnReturn = row.paid_full_on_return === true;
        var remainingFromAdvance = Math.max(0, totalAmt - advanceAmt);
        var isPaid = (status === 'returned' && paidFullOnReturn) || remainingFromAdvance <= 0;
        var statusText = (status === 'returned' ? 'Returned' : 'Pending') + (isPaid ? ' <span class="order-paid-tag">Paid</span>' : '');
        var orderIdDisplay = formatOrderNumber(row.order_number);
        var dateStr = (row.created_at || row.date) ? new Date(row.created_at || row.date).toLocaleString() : '—';
        var tr = document.createElement('tr');
        var safeId = String(rowId).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        var viewBtn = '<button type="button" class="btn btn--outline btn--small" onclick="window.abbaViewOrder(\'' + safeId + '\')">View</button>';
        var editBtn = isAdmin ? ' <button type="button" class="btn btn--outline btn--small" onclick="window.abbaEditOrder(\'' + safeId + '\')">Edit</button>' : '';
        var returnedBtn = isAdmin && status !== 'returned' ? ' <button type="button" class="btn btn--outline btn--small btn--returned" onclick="window.abbaSetOrderReturned(\'' + safeId + '\')">Returned</button>' : '';
        tr.innerHTML =
          '<td>' + escapeHtml(orderIdDisplay) + '</td>' +
          '<td>' + escapeHtml(dateStr) + '</td>' +
          '<td>' + escapeHtml(row.branch_name || row.branch || '—') + '</td>' +
          '<td>' + escapeHtml(row.customer_name || row.customerName || '—') + '</td>' +
          '<td>' + (totalAmt > 0 ? formatNumber(totalAmt) : '—') + '</td>' +
          '<td>' + statusText + '</td>' +
          '<td class="order-actions-cell">' + viewBtn + editBtn + returnedBtn + '</td>';
        tbody.appendChild(tr);
      }
      if (paginationEl) {
        var html = '<div class="pagination-bar">';
        html += '<button type="button" class="btn btn--outline btn--small pagination-bar__btn" data-page="first" ' + (orderHistoryPage <= 1 ? 'disabled' : '') + '>First</button>';
        html += '<button type="button" class="btn btn--outline btn--small pagination-bar__arrow" data-page="prev" ' + (orderHistoryPage <= 1 ? 'disabled' : '') + ' title="Previous">&lt;</button>';
        html += '<span class="pagination-bar__page">Page ' + orderHistoryPage + ' of ' + totalPages + '</span>';
        html += '<button type="button" class="btn btn--outline btn--small pagination-bar__arrow" data-page="next" ' + (orderHistoryPage >= totalPages ? 'disabled' : '') + ' title="Next">&gt;</button>';
        html += '<button type="button" class="btn btn--outline btn--small pagination-bar__btn" data-page="last" ' + (orderHistoryPage >= totalPages ? 'disabled' : '') + '>Last</button>';
        html += '</div>';
        paginationEl.innerHTML = html;
        paginationEl.querySelectorAll('.pagination-bar__btn, .pagination-bar__arrow').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var p = btn.getAttribute('data-page');
            if (p === 'first') { orderHistoryPage = 1; applyOrderHistoryFilters(); }
            else if (p === 'prev' && orderHistoryPage > 1) { orderHistoryPage--; applyOrderHistoryFilters(); }
            else if (p === 'next' && orderHistoryPage < totalPages) { orderHistoryPage++; applyOrderHistoryFilters(); }
            else if (p === 'last') { orderHistoryPage = totalPages; applyOrderHistoryFilters(); }
          });
        });
      }
    }
  }

  function setOrders(data) {
    allOrders = data || [];
    renderOrderHistory(getOrderHistoryFiltered());
    renderSalesByBranch(allOrders);
  }

  function loadOrders() {
    if (supabase) {
      supabase.from('orders').select('*').order('created_at', { ascending: false })
        .then(function (result) {
          if (result.error) throw result.error;
          setOrders(result.data || []);
        })
        .catch(function (err) {
          try {
            var orders = JSON.parse(localStorage.getItem('abba_orders') || '[]');
            setOrders(orders.slice().reverse());
          } catch (e) {
            setOrders([]);
          }
        });
    } else {
      try {
        var orders = JSON.parse(localStorage.getItem('abba_orders') || '[]');
        orders = orders.map(function (o, idx) {
          var id = o.id || o.orderId || 'local-' + (o.date ? new Date(o.date).getTime() : Date.now() + '-' + idx);
          var orderNum = (o.order_number != null && !isNaN(parseInt(o.order_number, 10))) ? parseInt(o.order_number, 10) : (idx + 1);
          return {
            id: id,
            orderId: id,
            order_number: orderNum,
            branch: o.branch || o.branchName,
            branch_name: o.branch_name || o.branch || o.branchName,
            customer_name: o.customer_name || o.customerName,
            customer_phone: o.customer_phone || o.customerPhone,
            order_details: o.order_details || o.orderDetails,
            total_amount: o.total_amount != null ? o.total_amount : o.totalAmount,
            advance: o.advance != null ? o.advance : 0,
            notes: o.notes,
            status: o.status || 'pending',
            returned_at: o.returned_at,
            paid_full_on_return: o.paid_full_on_return === true,
            created_at: o.created_at || o.date
          };
        });
        setOrders(orders.slice().reverse());
      } catch (err) {
        setOrders([]);
      }
    }
  }
  loadOrders();

  function getOrderById(orderId) {
    return allOrders.filter(function (o) { return (o.id || o.orderId) === orderId; })[0];
  }

  function openOrderView(orderId) {
    var order = getOrderById(orderId);
    if (!order) return;
    window._abbaViewedOrderId = orderId;
    window._abbaViewedOrder = order;
    var totalAmt = order.total_amount != null ? Number(order.total_amount) : (order.totalAmount != null ? Number(order.totalAmount) : 0);
    var advanceAmt = order.advance != null ? Number(order.advance) : 0;
    var status = (order.status || 'pending').toLowerCase();
    var paidFullOnReturn = order.paid_full_on_return === true;
    var remainingFromAdvance = Math.max(0, totalAmt - advanceAmt);
    var displayRemaining = (status === 'returned' && paidFullOnReturn) ? 0 : remainingFromAdvance;
    var isPaid = (status === 'returned' && paidFullOnReturn) || remainingFromAdvance <= 0;
    var dateStr = (order.created_at || order.date) ? new Date(order.created_at || order.date).toLocaleString() : '—';
    var returnedAt = order.returned_at;
    var returnedDateStr = returnedAt ? new Date(returnedAt).toLocaleString() : '—';
    var dl = document.getElementById('orderViewDetails');
    if (dl) {
      var orderIdDisplay = formatOrderNumber(order.order_number);
      var html =
        '<dt>Order ID</dt><dd>' + escapeHtml(orderIdDisplay) + '</dd>' +
        '<dt>Date & time</dt><dd>' + escapeHtml(dateStr) + '</dd>' +
        '<dt>Branch</dt><dd>' + escapeHtml(order.branch_name || order.branch || '—') + '</dd>' +
        '<dt>Customer</dt><dd>' + escapeHtml(order.customer_name || order.customerName || '—') + '</dd>' +
        '<dt>Phone</dt><dd>' + escapeHtml(order.customer_phone || order.customerPhone || '—') + '</dd>' +
        '<dt>Order details</dt><dd>' + escapeHtml(order.order_details || order.orderDetails || '—') + '</dd>' +
        '<dt>Order amount (LKR)</dt><dd>' + (totalAmt > 0 ? formatNumber(totalAmt) : '0.00') + '</dd>' +
        '<dt>Advance (LKR)</dt><dd>' + formatNumber(advanceAmt) + '</dd>' +
        '<dt>Remaining (LKR)</dt><dd>' + formatNumber(displayRemaining) + '</dd>' +
        '<dt>Status</dt><dd>' + (status === 'returned' ? 'Returned' : 'Pending') + (isPaid ? ' <span class="order-paid-tag">Paid</span>' : '') + '</dd>';
      if (status === 'returned') {
        html += '<dt>Return date</dt><dd>' + escapeHtml(returnedDateStr) + '</dd>';
        html += '<dt>Paid in full on return</dt><dd>' + (paidFullOnReturn ? 'Yes' : 'No') + '</dd>';
      }
      html += '<dt>Notes</dt><dd>' + escapeHtml(order.notes || '—') + '</dd>';
      dl.innerHTML = html;
    }
    var modal = document.getElementById('orderViewModal');
    var editBtn = document.getElementById('orderViewEditBtn');
    if (editBtn) editBtn.style.display = isAdmin ? '' : 'none';
    if (modal) modal.hidden = false;
  }

  function closeOrderViewModal() {
    var modal = document.getElementById('orderViewModal');
    if (modal) modal.hidden = true;
  }

  function editOrderFromView() {
    var id = window._abbaViewedOrderId;
    closeOrderViewModal();
    if (id) openOrderEdit(id);
  }

  function printOrderFromView() {
    var order = window._abbaViewedOrder || (window._abbaViewedOrderId ? getOrderById(window._abbaViewedOrderId) : null);
    if (order) printOrderReceipt(order);
  }

  function openOrderEdit(orderId) {
    var order = getOrderById(orderId);
    if (!order) return;
    if (orderFormTitle) orderFormTitle.textContent = 'Edit customer order';
    var titleSubEl = document.getElementById('homePanelTitleSub');
    if (titleSubEl) titleSubEl.textContent = 'Update order details';
    var contentHeadingEl = document.getElementById('homeContentHeading');
    if (contentHeadingEl) contentHeadingEl.textContent = 'Edit customer order';
    if (orderFormSubmitBtn) orderFormSubmitBtn.textContent = 'Update order';
    if (orderIdEl) orderIdEl.value = orderId;
    var orderIdFieldWrap = document.getElementById('orderFormOrderIdField');
    var orderDisplayIdEl = document.getElementById('orderDisplayId');
    if (orderIdFieldWrap) orderIdFieldWrap.hidden = false;
    if (orderDisplayIdEl) orderDisplayIdEl.textContent = formatOrderNumber(order.order_number);
    var nameEl = document.getElementById('customerName');
    var phoneEl = document.getElementById('customerPhone');
    var detailsEl = document.getElementById('orderDetails');
    var amountEl = document.getElementById('totalAmount');
    var advanceEl = document.getElementById('orderAdvance');
    var notesEl = document.getElementById('orderNotes');
    var totalVal = order.total_amount != null ? order.total_amount : (order.totalAmount != null ? order.totalAmount : '');
    var advanceVal = order.advance != null ? order.advance : '';
    if (nameEl) nameEl.value = String(order.customer_name || order.customerName || '');
    if (phoneEl) phoneEl.value = String(order.customer_phone || order.customerPhone || '');
    if (detailsEl) detailsEl.value = String(order.order_details || order.orderDetails || '');
    if (amountEl) amountEl.value = totalVal === '' || totalVal == null ? '' : String(totalVal);
    if (advanceEl) advanceEl.value = advanceVal === '' || advanceVal == null ? '' : String(advanceVal);
    if (notesEl) notesEl.value = String(order.notes || '');
    if (isAdmin && orderBranchSelect) orderBranchSelect.value = String(order.branch || 'panadura');
    updateOrderFormRemaining();
    showPanel('order-create');
  }

  var _abbaPendingReturnOrderId = null;

  function setOrderReturned(orderId) {
    var order = getOrderById(orderId);
    if (!order) return;
    var totalAmt = order.total_amount != null ? Number(order.total_amount) : (order.totalAmount != null ? Number(order.totalAmount) : 0);
    var advanceAmt = order.advance != null ? Number(order.advance) : 0;
    var remaining = Math.max(0, totalAmt - advanceAmt);
    if (remaining > 0) {
      _abbaPendingReturnOrderId = orderId;
      var msgEl = document.getElementById('returnConfirmMessage');
      if (msgEl) msgEl.textContent = 'Remaining balance: ' + formatNumber(remaining) + ' LKR. Did customer pay the full amount?';
      var modal = document.getElementById('returnConfirmModal');
      var paidBtn = document.getElementById('returnConfirmPaidBtn');
      var noPayBtn = document.getElementById('returnConfirmNoPaymentBtn');
      if (paidBtn) paidBtn.style.display = '';
      if (noPayBtn) noPayBtn.style.display = '';
      if (modal) modal.hidden = false;
      return;
    }
    if (!confirm('Mark this order as returned?')) return;
    doSetOrderReturned(orderId, true);
  }

  function closeReturnConfirmModal() {
    _abbaPendingReturnOrderId = null;
    var modal = document.getElementById('returnConfirmModal');
    if (modal) modal.hidden = true;
  }

  function doSetOrderReturned(orderId, paidFull) {
    var returnedAt = new Date().toISOString();
    var updatePayload = { status: 'returned', returned_at: returnedAt, paid_full_on_return: paidFull };
    if (supabase) {
      supabase.from('orders').update(updatePayload).eq('id', orderId)
        .then(function (result) {
          if (result.error) throw result.error;
          loadOrders();
        })
        .catch(function () {});
    } else {
      try {
        var raw = JSON.parse(localStorage.getItem('abba_orders') || '[]');
        var orders = raw.map(function (o, idx) {
          var id = o.id || o.orderId || 'local-' + (o.date ? new Date(o.date).getTime() : Date.now() + '-' + idx);
          var orderNum = (o.order_number != null && !isNaN(parseInt(o.order_number, 10))) ? parseInt(o.order_number, 10) : (idx + 1);
          return {
            id: id,
            order_number: orderNum,
            branch: o.branch || o.branchName,
            branch_name: o.branch_name || o.branch || o.branchName,
            customer_name: o.customer_name || o.customerName,
            customer_phone: o.customer_phone || o.customerPhone,
            order_details: o.order_details || o.orderDetails,
            total_amount: o.total_amount != null ? o.total_amount : o.totalAmount,
            advance: o.advance != null ? o.advance : 0,
            notes: o.notes,
            status: o.status || 'pending',
            returned_at: o.returned_at,
            paid_full_on_return: o.paid_full_on_return === true,
            created_at: o.created_at || o.date
          };
        });
        var idx = orders.findIndex(function (o) { return o.id === orderId; });
        if (idx >= 0) {
          orders[idx].status = 'returned';
          orders[idx].returned_at = returnedAt;
          orders[idx].paid_full_on_return = paidFull;
          localStorage.setItem('abba_orders', JSON.stringify(orders));
          allOrders = orders.slice().reverse();
          renderOrderHistory(getOrderHistoryFiltered());
          renderSalesByBranch(allOrders);
        }
      } catch (e) {}
    }
    closeReturnConfirmModal();
  }

  function confirmReturnPaidFull() {
    if (!_abbaPendingReturnOrderId) return;
    doSetOrderReturned(_abbaPendingReturnOrderId, true);
  }

  function confirmReturnNoPayment() {
    if (!_abbaPendingReturnOrderId) return;
    doSetOrderReturned(_abbaPendingReturnOrderId, false);
  }

  window.abbaEditOrder = openOrderEdit;
  window.abbaSetOrderReturned = setOrderReturned;
  window.abbaCloseReturnConfirmModal = closeReturnConfirmModal;
  window.abbaConfirmReturnPaidFull = confirmReturnPaidFull;
  window.abbaConfirmReturnNoPayment = confirmReturnNoPayment;
  window.abbaViewOrder = openOrderView;
  window.abbaCloseOrderViewModal = closeOrderViewModal;
  window.abbaEditOrderFromView = editOrderFromView;
  window.abbaPrintOrderFromView = printOrderFromView;

  function escapeHtml(str) {
    if (str == null) return '—';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  function formatDisplayDate(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function formatNumber(n) {
    return Number(n).toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function formatOrderNumber(n) {
    if (n == null || n === '') return '—';
    var num = parseInt(n, 10);
    if (isNaN(num) || num < 0) return '—';
    return String(num).padStart(6, '0');
  }
  var _abbaNewOrderNumber = null;
  function setNewOrderIdDisplay() {
    _abbaNewOrderNumber = Math.floor(100000 + Math.random() * 900000);
    var orderIdFieldWrap = document.getElementById('orderFormOrderIdField');
    var orderDisplayIdEl = document.getElementById('orderDisplayId');
    if (orderIdFieldWrap) orderIdFieldWrap.hidden = false;
    if (orderDisplayIdEl) orderDisplayIdEl.textContent = formatOrderNumber(_abbaNewOrderNumber);
  }

  // Leave year = join-date anniversary to next anniversary. Allowance = 12 days/year (1 per month), renews each year.
  function getLeaveYearBounds(joinDateStr, asOfDate) {
    if (!joinDateStr) return null;
    var join = new Date(joinDateStr);
    if (isNaN(join.getTime())) return null;
    var joinMonth = join.getMonth();
    var joinDay = join.getDate();
    var asOf = asOfDate || new Date();
    var y = asOf.getFullYear();
    var start = new Date(y, joinMonth, joinDay);
    if (start > asOf) start = new Date(y - 1, joinMonth, joinDay);
    var end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
    end.setDate(end.getDate() - 1);
    return {
      start: start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0') + '-' + String(start.getDate()).padStart(2, '0'),
      end: end.getFullYear() + '-' + String(end.getMonth() + 1).padStart(2, '0') + '-' + String(end.getDate()).padStart(2, '0')
    };
  }

  function getLeaveStatsForEmployee(emp, leaveRecords) {
    var asOf = new Date();
    var bounds = emp.join_date ? getLeaveYearBounds(emp.join_date, asOf) : null;
    var yearStart, yearEnd;
    if (bounds) {
      yearStart = bounds.start;
      yearEnd = bounds.end;
    } else {
      var y = asOf.getFullYear();
      yearStart = y + '-01-01';
      yearEnd = y + '-12-31';
    }
    var todayStr = asOf.getFullYear() + '-' + String(asOf.getMonth() + 1).padStart(2, '0') + '-' + String(asOf.getDate()).padStart(2, '0');
    // Allowance = 1 day per completed full month from leave-year start to today (max 12). No leave until first month is complete.
    var startD = new Date(yearStart);
    var monthsSoFar = (asOf.getFullYear() - startD.getFullYear()) * 12 + (asOf.getMonth() - startD.getMonth());
    if (asOf.getDate() < startD.getDate()) monthsSoFar -= 1;
    var allowance = Math.min(12, Math.max(0, monthsSoFar));
    // Count leave only from yearStart up to today (current date), not whole year
    var employeeLeaves = leaveRecords.filter(function (r) {
      if (r.employee_id !== emp.id || !r.start_date || !r.end_date) return false;
      return r.end_date >= yearStart && r.start_date <= todayStr;
    });
    var used = employeeLeaves.reduce(function (sum, r) { return sum + (Number(r.days) || 0); }, 0);
    var remaining = Math.max(0, allowance - used);
    return { allowance: allowance, used: used, remaining: remaining, yearStart: yearStart, yearEnd: yearEnd, todayStr: todayStr };
  }

  // Order form: remaining to give (total - advance)
  function updateOrderFormRemaining() {
    var totalEl = document.getElementById('totalAmount');
    var advanceEl = document.getElementById('orderAdvance');
    var remEl = document.getElementById('orderRemainingToGive');
    if (!remEl) return;
    var total = parseFloat(totalEl && totalEl.value) || 0;
    var advance = parseFloat(advanceEl && advanceEl.value) || 0;
    var remaining = Math.max(0, total - advance);
    if (total > 0) {
      remEl.textContent = 'Remaining to give: ' + formatNumber(remaining) + ' LKR';
      remEl.hidden = false;
    } else {
      remEl.textContent = '';
      remEl.hidden = true;
    }
  }
  var totalAmountEl = document.getElementById('totalAmount');
  var orderAdvanceEl = document.getElementById('orderAdvance');
  if (totalAmountEl) totalAmountEl.addEventListener('input', updateOrderFormRemaining);
  if (orderAdvanceEl) orderAdvanceEl.addEventListener('input', updateOrderFormRemaining);

  // Order form submit & print receipt
  var orderForm = document.getElementById('orderForm');
  var orderMessage = document.getElementById('orderMessage');
  var orderPrintWrap = document.getElementById('orderPrintWrap');
  var orderPrintReceiptBtn = document.getElementById('orderPrintReceiptBtn');
  var orderIdEl = document.getElementById('orderId');
  var orderFormTitle = document.getElementById('homePanelTitle');
  var orderFormSubmitBtn = document.getElementById('orderFormSubmitBtn');
  var lastReceiptOrder = null;

  function printOrderReceipt(order) {
    if (!order) return;
    function esc(s) {
      if (s == null || s === '') return '—';
      s = String(s);
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    var orderNum = order.order_number || order.orderNumber || order.id || '—';
    var dateStr = order.created_at || order.date;
    if (dateStr) {
      try { dateStr = new Date(dateStr).toLocaleString(); } catch (e) { dateStr = '—'; }
    } else { dateStr = new Date().toLocaleString(); }
    var branch = order.branch_name || order.branchName || order.branch || '';
    var total = parseFloat(order.total_amount != null ? order.total_amount : order.totalAmount) || 0;
    var advance = parseFloat(order.advance) || 0;
    var pending = total - advance;
    var detailsRaw = order.order_details || order.orderDetails || '—';
    var details = esc(detailsRaw).replace(/\n/g, '<br>');
    var notes = order.notes && String(order.notes).trim();
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt #' + esc(orderNum) + '</title><style>body{font-family:Georgia,serif;max-width:320px;margin:1rem auto;padding:1rem;}h1{font-size:1.25rem;margin:0 0 0.5rem;}h2{font-size:0.9rem;color:#555;margin:0 0 1rem;}table{width:100%;border-collapse:collapse;}td{padding:0.25rem 0;}td:first-child{color:#555;}tr.border td{border-top:1px solid #ddd;padding-top:0.5rem;}.total{font-weight:bold;font-size:1.1rem;}.foot{ margin-top:1.5rem;font-size:0.8rem;color:#666;}</style></head><body>';
    html += '<h1>ABBA International Men\'s Wear</h1><h2>Order Receipt</h2>';
    html += '<table><tr><td>Order ID</td><td>' + esc(orderNum) + '</td></tr>';
    html += '<tr><td>Date</td><td>' + esc(dateStr) + '</td></tr>';
    html += '<tr><td>Branch</td><td>' + esc(branch) + '</td></tr>';
    html += '<tr><td>Customer</td><td>' + esc(order.customer_name || order.customerName) + '</td></tr>';
    html += '<tr><td>Phone</td><td>' + esc(order.customer_phone || order.customerPhone) + '</td></tr>';
    html += '<tr class="border"><td>Details</td><td>' + details + '</td></tr>';
    html += '<tr class="border"><td>Total (LKR)</td><td class="total">' + total.toFixed(2) + '</td></tr>';
    html += '<tr><td>Advance (LKR)</td><td>' + advance.toFixed(2) + '</td></tr>';
    html += '<tr><td>Balance (LKR)</td><td>' + pending.toFixed(2) + '</td></tr>';
    if (notes) html += '<tr><td>Notes</td><td>' + esc(notes) + '</td></tr>';
    html += '</table><p class="foot">Thank you.</p></body></html>';
    var w = window.open('', '_blank', 'width=400,height=600');
    if (!w) {
      alert('Please allow popups for this site to print the receipt.');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.setTimeout(function () {
      try { w.print(); } catch (e) {}
      w.onafterprint = function () { w.close(); };
    }, 250);
  }

  if (orderForm && orderMessage) {
    orderForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (orderPrintWrap) orderPrintWrap.hidden = true;
      var name = document.getElementById('customerName');
      var phone = document.getElementById('customerPhone');
      var details = document.getElementById('orderDetails');
      var amount = document.getElementById('totalAmount');
      var nameError = document.getElementById('customerNameError');
      var phoneError = document.getElementById('customerPhoneError');
      var detailsError = document.getElementById('orderDetailsError');
      var amountError = document.getElementById('totalAmountError');

      orderMessage.textContent = '';
      orderMessage.className = 'order-form__message';

      if (!name.value.trim()) {
        nameError.textContent = 'Customer name is required';
        name.classList.add('field__input--error');
      } else { nameError.textContent = ''; name.classList.remove('field__input--error'); }
      if (!phone.value.trim()) {
        phoneError.textContent = 'Phone is required';
        phone.classList.add('field__input--error');
      } else { phoneError.textContent = ''; phone.classList.remove('field__input--error'); }
      if (!details.value.trim()) {
        detailsError.textContent = 'Order details are required';
        details.classList.add('field__input--error');
      } else { detailsError.textContent = ''; details.classList.remove('field__input--error'); }
      if (!amount.value || parseFloat(amount.value) < 0) {
        amountError.textContent = 'Enter a valid amount';
        amount.classList.add('field__input--error');
      } else { amountError.textContent = ''; amount.classList.remove('field__input--error'); }
      if (nameError.textContent || phoneError.textContent || detailsError.textContent || amountError.textContent) return;

      var saveBranch = orderBranchSelect ? orderBranchSelect.value : branch;
      var saveBranchName = branchNames[saveBranch] || saveBranch;

      var notesEl = document.getElementById('orderNotes');
      var advanceEl = document.getElementById('orderAdvance');
      var notesVal = (notesEl && notesEl.value) ? notesEl.value.trim() : '';
      var advanceVal = parseFloat(advanceEl && advanceEl.value) || 0;
      var editingId = (orderIdEl && orderIdEl.value) ? orderIdEl.value.trim() : '';
      var payload = {
        branch: saveBranch,
        branch_name: saveBranchName,
        customer_name: name.value.trim(),
        customer_phone: phone.value.trim(),
        order_details: details.value.trim(),
        total_amount: parseFloat(amount.value) || 0,
        advance: advanceVal,
        notes: notesVal
      };

      function clearEditMode() {
        if (orderIdEl) orderIdEl.value = '';
        if (orderFormTitle) orderFormTitle.textContent = 'New customer order';
        var titleSubEl = document.getElementById('homePanelTitleSub');
        if (titleSubEl) titleSubEl.textContent = 'Create a new customer order';
        var contentHeadingEl = document.getElementById('homeContentHeading');
        if (contentHeadingEl) contentHeadingEl.textContent = 'New customer order';
        if (orderFormSubmitBtn) orderFormSubmitBtn.textContent = 'Save order';
        setNewOrderIdDisplay();
        setOrderFormBranchDefault();
      }

      if (supabase) {
        var saveBtn = orderForm.querySelector('.order-form__submit');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
        if (editingId) {
          var displayIdEl = document.getElementById('orderDisplayId');
          var orderNumForReceipt = (displayIdEl && displayIdEl.textContent) ? displayIdEl.textContent.trim() : editingId;
          supabase.from('orders').update(payload).eq('id', editingId)
            .then(function (result) {
              if (result.error) throw result.error;
              orderMessage.textContent = 'Order updated.';
              orderMessage.className = 'order-form__message order-form__message--success';
              lastReceiptOrder = { order_number: orderNumForReceipt, created_at: new Date().toISOString(), date: new Date().toISOString(), branch_name: payload.branch_name, branch: payload.branch, customer_name: payload.customer_name, customer_phone: payload.customer_phone, order_details: payload.order_details, total_amount: payload.total_amount, advance: payload.advance, notes: payload.notes };
              if (orderPrintWrap) orderPrintWrap.hidden = false;
              orderForm.reset();
              clearEditMode();
              updateOrderFormRemaining();
              loadOrders();
            })
            .catch(function (err) {
              orderMessage.textContent = 'Failed to save: ' + (err.message || 'check config');
              orderMessage.className = 'order-form__message order-form__message--error';
            })
            .finally(function () {
              if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Update order'; }
            });
        } else {
          payload.order_number = _abbaNewOrderNumber != null ? _abbaNewOrderNumber : Math.floor(100000 + Math.random() * 900000);
          supabase.from('orders').insert(payload)
            .then(function (result) {
            if (result.error) throw result.error;
            orderMessage.textContent = 'Order saved to database.';
            orderMessage.className = 'order-form__message order-form__message--success';
            lastReceiptOrder = { order_number: payload.order_number, created_at: new Date().toISOString(), date: new Date().toISOString(), branch_name: payload.branch_name, branch: payload.branch, customer_name: payload.customer_name, customer_phone: payload.customer_phone, order_details: payload.order_details, total_amount: payload.total_amount, advance: payload.advance, notes: payload.notes };
            if (orderPrintWrap) orderPrintWrap.hidden = false;
            orderForm.reset();
            clearEditMode();
            updateOrderFormRemaining();
            loadOrders();
          })
          .catch(function (err) {
            orderMessage.textContent = 'Failed to save: ' + (err.message || 'check config');
            orderMessage.className = 'order-form__message order-form__message--error';
          })
          .finally(function () {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save order'; }
          });
        }
      } else {
        var totalAmt = parseFloat(amount.value) || 0;
        try {
          var orders = JSON.parse(localStorage.getItem('abba_orders') || '[]');
          var existingOrder = editingId ? orders.filter(function (o) { return (o.id || o.orderId) === editingId; })[0] : null;
          var order = {
            id: editingId || 'local-' + Date.now(),
            order_number: editingId && existingOrder && existingOrder.order_number != null ? existingOrder.order_number : (_abbaNewOrderNumber != null ? _abbaNewOrderNumber : Math.floor(100000 + Math.random() * 900000)),
            branch: saveBranch,
            branch_name: saveBranchName,
            branchName: saveBranchName,
            customer_name: name.value.trim(),
            customerName: name.value.trim(),
            customer_phone: phone.value.trim(),
            customerPhone: phone.value.trim(),
            order_details: details.value.trim(),
            orderDetails: details.value.trim(),
            total_amount: totalAmt,
            totalAmount: totalAmt,
            advance: advanceVal,
            notes: notesVal,
            status: editingId && existingOrder ? (existingOrder.status || 'pending') : 'pending',
            created_at: editingId && existingOrder ? (existingOrder.created_at || existingOrder.date) : new Date().toISOString(),
            date: new Date().toISOString()
          };
          if (editingId && existingOrder) {
            order.returned_at = existingOrder.returned_at;
            order.paid_full_on_return = existingOrder.paid_full_on_return === true;
          }
          if (editingId) {
            var idx = orders.findIndex(function (o) { return (o.id || o.orderId) === editingId; });
            if (idx >= 0) {
              orders[idx] = order;
            } else {
              orders.push(order);
            }
          } else {
            orders.push(order);
          }
          localStorage.setItem('abba_orders', JSON.stringify(orders));
          allOrders = orders.slice().reverse();
          renderOrderHistory(allOrders);
          renderSalesByBranch(allOrders);
          lastReceiptOrder = order;
          if (orderPrintWrap) orderPrintWrap.hidden = false;
        } catch (err) {}
        orderMessage.textContent = editingId ? 'Order updated (local).' : 'Order saved (local). Add Supabase in js/config.js for all branches.';
        orderMessage.className = 'order-form__message order-form__message--success';
        orderForm.reset();
        clearEditMode();
        updateOrderFormRemaining();
      }
    });
  }
  if (orderPrintReceiptBtn) {
    orderPrintReceiptBtn.addEventListener('click', function () { printOrderReceipt(lastReceiptOrder); });
  }

  // ——— Employee management (admin only) ———
  var allEmployees = [];
  var allLeaveRecords = [];
  var employeeModal = document.getElementById('employeeModal');
  var employeeForm = document.getElementById('employeeForm');
  var employeeModalTitle = document.getElementById('employeeModalTitle');
  var employeeIdInput = document.getElementById('employeeId');
  var employeeViewModal = document.getElementById('employeeViewModal');
  var addLeaveModal = document.getElementById('addLeaveModal');

  if (employeeModal) employeeModal.hidden = true;
  if (employeeViewModal) employeeViewModal.hidden = true;
  if (addLeaveModal) addLeaveModal.hidden = true;
  var orderViewModal = document.getElementById('orderViewModal');
  if (orderViewModal) orderViewModal.hidden = true;
  var returnConfirmModal = document.getElementById('returnConfirmModal');
  if (returnConfirmModal) returnConfirmModal.hidden = true;

  function loadLeaveRecords(onDone) {
    if (!isAdmin) return;
    if (supabase) {
      supabase.from('leave_records').select('*').order('start_date', { ascending: false })
        .then(function (result) {
          if (result.error) throw result.error;
          allLeaveRecords = result.data || [];
          if (typeof onDone === 'function') onDone();
        })
        .catch(function () {
          try {
            allLeaveRecords = JSON.parse(localStorage.getItem('abba_leave_records') || '[]');
          } catch (e) { allLeaveRecords = []; }
          if (typeof onDone === 'function') onDone();
        });
    } else {
      try {
        allLeaveRecords = JSON.parse(localStorage.getItem('abba_leave_records') || '[]');
      } catch (e) { allLeaveRecords = []; }
      if (typeof onDone === 'function') onDone();
    }
  }

  function loadEmployees() {
    if (!isAdmin) return;
    var leaveReportVisible = function () {
      var el = document.getElementById('panel-leave-report');
      return el && !el.classList.contains('home-panel--hidden');
    };
    var onLeaveDone = function () { if (leaveReportVisible()) renderLeaveReport(); };
    if (supabase) {
      supabase.from('employees').select('*').order('created_at', { ascending: false })
        .then(function (result) {
          if (result.error) throw result.error;
          allEmployees = result.data || [];
          renderEmployees();
          loadLeaveRecords(onLeaveDone);
        })
        .catch(function () {
          try {
            allEmployees = JSON.parse(localStorage.getItem('abba_employees') || '[]');
            renderEmployees();
            loadLeaveRecords(onLeaveDone);
          } catch (e) { renderEmployees(); loadLeaveRecords(onLeaveDone); }
        });
    } else {
      try {
        allEmployees = JSON.parse(localStorage.getItem('abba_employees') || '[]');
      } catch (e) { allEmployees = []; }
      renderEmployees();
      loadLeaveRecords(onLeaveDone);
    }
  }

  function renderEmployees() {
    var tbody = document.getElementById('employeesBody');
    var emptyEl = document.getElementById('employeesEmpty');
    var tableEl = document.getElementById('employeesTable');
    var paginationEl = document.getElementById('employeesPagination');
    if (!tbody) return;
    tbody.innerHTML = '';
    var searchEl = document.getElementById('employeeSearch');
    var searchVal = (searchEl && searchEl.value) ? searchEl.value.trim().toLowerCase() : '';
    var list = (allEmployees || []).filter(function (emp) {
      if (!searchVal) return true;
      var name = (emp.name || '').toLowerCase();
      var phone = (emp.phone || '').toLowerCase();
      var email = (emp.email || '').toLowerCase();
      var branchStr = (branchNames[emp.branch] || emp.branch || '').toLowerCase();
      var roleStr = (emp.role === 'admin' ? 'admin' : 'staff');
      return name.indexOf(searchVal) !== -1 ||
        phone.indexOf(searchVal) !== -1 ||
        email.indexOf(searchVal) !== -1 ||
        branchStr.indexOf(searchVal) !== -1 ||
        roleStr.indexOf(searchVal) !== -1;
    });
    var total = list.length;
    var totalPages = Math.max(1, Math.ceil(total / EMPLOYEE_PAGE_SIZE));
    if (employeePage > totalPages) employeePage = totalPages;
    var start = (employeePage - 1) * EMPLOYEE_PAGE_SIZE;
    var pageList = list.slice(start, start + EMPLOYEE_PAGE_SIZE);
    if (list.length === 0) {
      if (emptyEl) {
        emptyEl.textContent = searchVal ? 'No employees match the search.' : 'No employees yet.';
        emptyEl.style.display = 'block';
      }
      if (tableEl) tableEl.style.display = 'none';
      if (paginationEl) paginationEl.innerHTML = '';
    } else {
      if (emptyEl) emptyEl.style.display = 'none';
      if (tableEl) tableEl.style.display = 'table';
      for (var i = 0; i < pageList.length; i++) {
        var emp = pageList[i];
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + escapeHtml(emp.name) + '</td>' +
          '<td>' + escapeHtml(emp.phone || '—') + '</td>' +
          '<td>' + escapeHtml(emp.email || '—') + '</td>' +
          '<td>' + escapeHtml(branchNames[emp.branch] || emp.branch) + '</td>' +
          '<td>' + escapeHtml(emp.role === 'admin' ? 'Admin' : 'Staff') + '</td>' +
          '<td><button type="button" class="btn-employee-action" data-action="view" data-id="' + escapeHtml(emp.id) + '">View</button> ' +
          '<button type="button" class="btn-employee-action" data-action="edit" data-id="' + escapeHtml(emp.id) + '">Edit</button> ' +
          '<button type="button" class="btn-employee-action btn-employee-action--danger" data-action="delete" data-id="' + escapeHtml(emp.id) + '">Delete</button></td>';
        tbody.appendChild(tr);
      }
      if (paginationEl) {
        var html = '<div class="pagination-bar">';
        html += '<button type="button" class="btn btn--outline btn--small pagination-bar__btn" data-page="first" ' + (employeePage <= 1 ? 'disabled' : '') + '>First</button>';
        html += '<button type="button" class="btn btn--outline btn--small pagination-bar__arrow" data-page="prev" ' + (employeePage <= 1 ? 'disabled' : '') + ' title="Previous">&lt;</button>';
        html += '<span class="pagination-bar__page">Page ' + employeePage + ' of ' + totalPages + '</span>';
        html += '<button type="button" class="btn btn--outline btn--small pagination-bar__arrow" data-page="next" ' + (employeePage >= totalPages ? 'disabled' : '') + ' title="Next">&gt;</button>';
        html += '<button type="button" class="btn btn--outline btn--small pagination-bar__btn" data-page="last" ' + (employeePage >= totalPages ? 'disabled' : '') + '>Last</button>';
        html += '</div>';
        paginationEl.innerHTML = html;
        paginationEl.querySelectorAll('.pagination-bar__btn, .pagination-bar__arrow').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var p = btn.getAttribute('data-page');
            if (p === 'first') { employeePage = 1; renderEmployees(); }
            else if (p === 'prev' && employeePage > 1) { employeePage--; renderEmployees(); }
            else if (p === 'next' && employeePage < totalPages) { employeePage++; renderEmployees(); }
            else if (p === 'last') { employeePage = totalPages; renderEmployees(); }
          });
        });
      }
    }
    document.querySelectorAll('.btn-employee-action[data-action="view"]').forEach(function (btn) {
      btn.addEventListener('click', function () { openEmployeeViewModal(btn.getAttribute('data-id')); });
    });
    document.querySelectorAll('.btn-employee-action[data-action="edit"]').forEach(function (btn) {
      btn.addEventListener('click', function () { openEmployeeModal(btn.getAttribute('data-id')); });
    });
    document.querySelectorAll('.btn-employee-action[data-action="delete"]').forEach(function (btn) {
      btn.addEventListener('click', function () { deleteEmployee(btn.getAttribute('data-id')); });
    });
  }

  function openEmployeeModal(id) {
    if (employeeModal) employeeModal.hidden = false;
    if (employeeModalTitle) employeeModalTitle.textContent = id ? 'Edit employee' : 'Add employee';
    if (employeeIdInput) employeeIdInput.value = id || '';
    if (employeeForm) employeeForm.reset();
    if (id) {
      var emp = allEmployees.filter(function (e) { return e.id === id; })[0];
      if (emp) {
        if (document.getElementById('empName')) document.getElementById('empName').value = emp.name || '';
        if (document.getElementById('empPhone')) document.getElementById('empPhone').value = emp.phone || '';
        if (document.getElementById('empEmail')) document.getElementById('empEmail').value = emp.email || '';
        if (document.getElementById('empBranch')) document.getElementById('empBranch').value = emp.branch || 'panadura';
        if (document.getElementById('empRole')) document.getElementById('empRole').value = emp.role || 'staff';
        var stillWorking = document.getElementById('empStillWorking');
        var endDateInput = document.getElementById('empEndDate');
        if (stillWorking) stillWorking.checked = emp.is_active !== false;
        if (document.getElementById('empJoinDate')) document.getElementById('empJoinDate').value = emp.join_date || '';
        if (endDateInput) {
          endDateInput.value = (emp.end_date && emp.is_active === false) ? emp.end_date : '';
          endDateInput.disabled = emp.is_active !== false;
        }
      }
    } else {
      var stillWorking = document.getElementById('empStillWorking');
      var endDateInput = document.getElementById('empEndDate');
      if (stillWorking) stillWorking.checked = true;
      if (endDateInput) endDateInput.disabled = true;
    }
    toggleEndDateFromStillWorking();
  }

  function toggleEndDateFromStillWorking() {
    var stillWorking = document.getElementById('empStillWorking');
    var endDateInput = document.getElementById('empEndDate');
    if (!stillWorking || !endDateInput) return;
    endDateInput.disabled = stillWorking.checked;
    if (stillWorking.checked) endDateInput.value = '';
  }

  function closeEmployeeModal() {
    if (employeeModal) employeeModal.hidden = true;
  }

  function openEmployeeViewModal(id) {
    if (!id || !employeeViewModal) return;
    var emp = allEmployees.filter(function (e) { return e.id === id; })[0];
    if (!emp) return;
    var stats = getLeaveStatsForEmployee(emp, allLeaveRecords);
    var allowance = stats.allowance;
    var used = stats.used;
    var remaining = stats.remaining;

    if (document.getElementById('employeeViewModalTitle')) {
      document.getElementById('employeeViewModalTitle').textContent = emp.name + ' — Details';
    }
    var dl = document.getElementById('employeeViewDetails');
    if (dl) {
      var joinDate = emp.join_date ? formatDisplayDate(emp.join_date) : '—';
      var endDate = (emp.end_date && !emp.is_active) ? formatDisplayDate(emp.end_date) : '—';
      var status = emp.is_active !== false ? 'Active' : 'Left';
      dl.innerHTML =
        '<dt>Name</dt><dd>' + escapeHtml(emp.name) + '</dd>' +
        '<dt>Phone</dt><dd>' + escapeHtml(emp.phone || '—') + '</dd>' +
        '<dt>Email</dt><dd>' + escapeHtml(emp.email || '—') + '</dd>' +
        '<dt>Branch</dt><dd>' + escapeHtml(branchNames[emp.branch] || emp.branch) + '</dd>' +
        '<dt>Role</dt><dd>' + escapeHtml(emp.role === 'admin' ? 'Admin' : 'Staff') + '</dd>' +
        '<dt>Join date</dt><dd>' + joinDate + '</dd>' +
        '<dt>End date</dt><dd>' + endDate + '</dd>' +
        '<dt>Status</dt><dd>' + status + '</dd>';
    }
    var usedEl = document.getElementById('employeeViewLeaveUsed');
    var remValEl = document.getElementById('employeeViewLeaveRemainingVal');
    var metaEl = document.getElementById('employeeViewLeaveMeta');
    if (usedEl) usedEl.textContent = used;
    if (remValEl) remValEl.textContent = remaining;
    if (metaEl) metaEl.textContent = 'Allowance: ' + allowance + ' days to date (1 per month from leave-year start). Leave year: ' + stats.yearStart + ' to ' + stats.yearEnd + '. Shown up to ' + stats.todayStr;

    var allForEmployee = allLeaveRecords.filter(function (r) { return r.employee_id === id; });
    var tbody = document.getElementById('employeeViewLeaveBody');
    var emptyEl = document.getElementById('employeeViewLeaveEmpty');
    var tableEl = document.getElementById('employeeViewLeaveTable');
    if (tbody) tbody.innerHTML = '';
    if (allForEmployee.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      if (tableEl) tableEl.style.display = 'none';
    } else {
      if (emptyEl) emptyEl.style.display = 'none';
      if (tableEl) tableEl.style.display = 'table';
      allForEmployee.forEach(function (r) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + escapeHtml(r.start_date || '—') + '</td>' +
          '<td>' + escapeHtml(r.end_date || '—') + '</td>' +
          '<td>' + (r.days != null ? r.days : '—') + '</td>' +
          '<td>' + escapeHtml(r.leave_type || 'annual') + '</td>' +
          '<td>' + escapeHtml(r.notes || '—') + '</td>';
        tbody.appendChild(tr);
      });
    }
    employeeViewModal.hidden = false;
  }

  function closeEmployeeViewModal() {
    if (employeeViewModal) employeeViewModal.hidden = true;
  }

  function getEmployeesOnLeaveForDate(selectedDate, branchFilter) {
    var dateStr = selectedDate;
    if (!dateStr) return [];
    var onLeave = [];
    allLeaveRecords.forEach(function (r) {
      if (!r.start_date || !r.end_date) return;
      if (dateStr >= r.start_date && dateStr <= r.end_date) {
        var emp = allEmployees.filter(function (e) { return e.id === r.employee_id; })[0];
        if (!emp || (emp.is_active === false)) return;
        if (branchFilter && emp.branch !== branchFilter) return;
        onLeave.push({ emp: emp, record: r });
      }
    });
    return onLeave;
  }

  function renderLeaveReport() {
    if (!isAdmin) return;
    var dateEl = document.getElementById('leaveReportDate');
    var branchEl = document.getElementById('leaveReportBranch');
    var container = document.getElementById('leaveReportByBranch');
    var emptyEl = document.getElementById('leaveReportEmpty');
    var paginationEl = document.getElementById('leaveReportPagination');
    if (!dateEl || !container) return;
    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    if (!dateEl.value) dateEl.value = todayStr;
    var selectedDate = dateEl.value;
    var branchFilter = (branchEl && branchEl.value) ? branchEl.value : '';
    var onLeave = getEmployeesOnLeaveForDate(selectedDate, branchFilter);
    var total = onLeave.length;
    var totalPages = Math.max(1, Math.ceil(total / LEAVE_REPORT_PAGE_SIZE));
    if (leaveReportPage > totalPages) leaveReportPage = totalPages;
    var start = (leaveReportPage - 1) * LEAVE_REPORT_PAGE_SIZE;
    var pageList = onLeave.slice(start, start + LEAVE_REPORT_PAGE_SIZE);
    if (onLeave.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      container.innerHTML = '';
      if (paginationEl) paginationEl.innerHTML = '';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    var html = '<table class="admin-orders-table"><thead><tr><th>Branch</th><th>Employee</th><th>Leave type</th><th>Start</th><th>End</th><th>Days</th><th>Notes</th></tr></thead><tbody>';
    pageList.forEach(function (item) {
      var b = item.emp.branch || 'other';
      var branchName = branchNames[b] || b;
      html += '<tr><td>' + escapeHtml(branchName) + '</td><td>' + escapeHtml(item.emp.name) + '</td><td>' + escapeHtml(item.record.leave_type || 'annual') + '</td><td>' + escapeHtml(item.record.start_date || '—') + '</td><td>' + escapeHtml(item.record.end_date || '—') + '</td><td>' + (item.record.days != null ? item.record.days : '—') + '</td><td>' + escapeHtml(item.record.notes || '—') + '</td></tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
    if (paginationEl) {
      var pHtml = '<div class="pagination-bar">';
      pHtml += '<button type="button" class="btn btn--outline btn--small pagination-bar__btn" data-page="first" ' + (leaveReportPage <= 1 ? 'disabled' : '') + '>First</button>';
      pHtml += '<button type="button" class="btn btn--outline btn--small pagination-bar__arrow" data-page="prev" ' + (leaveReportPage <= 1 ? 'disabled' : '') + ' title="Previous">&lt;</button>';
      pHtml += '<span class="pagination-bar__page">Page ' + leaveReportPage + ' of ' + totalPages + '</span>';
      pHtml += '<button type="button" class="btn btn--outline btn--small pagination-bar__arrow" data-page="next" ' + (leaveReportPage >= totalPages ? 'disabled' : '') + ' title="Next">&gt;</button>';
      pHtml += '<button type="button" class="btn btn--outline btn--small pagination-bar__btn" data-page="last" ' + (leaveReportPage >= totalPages ? 'disabled' : '') + '>Last</button>';
      pHtml += '</div>';
      paginationEl.innerHTML = pHtml;
      paginationEl.querySelectorAll('.pagination-bar__btn, .pagination-bar__arrow').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var p = btn.getAttribute('data-page');
          if (p === 'first') { leaveReportPage = 1; renderLeaveReport(); }
          else if (p === 'prev' && leaveReportPage > 1) { leaveReportPage--; renderLeaveReport(); }
          else if (p === 'next' && leaveReportPage < totalPages) { leaveReportPage++; renderLeaveReport(); }
          else if (p === 'last') { leaveReportPage = totalPages; renderLeaveReport(); }
        });
      });
    }
  }

  function openAddLeaveModal() {
    showAddLeaveError('');
    var sel = document.getElementById('leaveEmployeeId');
    if (sel) {
      sel.innerHTML = '<option value="">Select employee</option>';
      allEmployees.forEach(function (e) {
        var opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = e.name + ' (' + (branchNames[e.branch] || e.branch) + ')';
        sel.appendChild(opt);
      });
    }
    if (document.getElementById('addLeaveForm')) document.getElementById('addLeaveForm').reset();
    if (addLeaveModal) addLeaveModal.hidden = false;
  }

  function closeAddLeaveModal() {
    if (addLeaveModal) addLeaveModal.hidden = true;
  }

  function showLeaveSuccessMessage() {
      var msgEl = document.getElementById('employeeMessage');
      if (msgEl) {
        msgEl.textContent = 'Leave added successfully.';
        msgEl.hidden = false;
        msgEl.classList.add('employee-message--success');
        window.clearTimeout(window._employeeMsgTimer);
        window._employeeMsgTimer = window.setTimeout(function () {
          msgEl.hidden = true;
          msgEl.textContent = '';
        }, 4000);
      }
    }

  function showAddLeaveError(msg) {
      var el = document.getElementById('addLeaveError');
      if (el) {
        el.textContent = msg || '';
        el.style.display = msg ? 'block' : 'none';
      }
    }

  function saveLeaveForm() {
    showAddLeaveError('');
    var empIdEl = document.getElementById('leaveEmployeeId');
    var startEl = document.getElementById('leaveStartDate');
    var endEl = document.getElementById('leaveEndDate');
    var daysEl = document.getElementById('leaveDays');
    var empId = empIdEl ? empIdEl.value : '';
    var startDate = startEl ? startEl.value : '';
    var endDate = endEl ? endEl.value : '';
    var days = daysEl ? daysEl.value : '';
    var leaveType = (document.getElementById('leaveType') && document.getElementById('leaveType').value) || 'annual';
    var notes = (document.getElementById('leaveNotes') && document.getElementById('leaveNotes').value) || '';
    if (!empId) {
      showAddLeaveError('Please select an employee.');
      return;
    }
    if (!startDate || !endDate) {
      showAddLeaveError('Please enter start and end date.');
      return;
    }
    var daysNum = Number(days);
    if (days === '' || isNaN(daysNum) || daysNum < 0) {
      showAddLeaveError('Please enter a valid number of days.');
      return;
    }
    var payload = {
      employee_id: empId,
      start_date: startDate,
      end_date: endDate,
      days: daysNum,
      leave_type: leaveType,
      notes: (notes && notes.trim()) ? notes.trim() : ''
    };
    if (supabase) {
      supabase.from('leave_records').insert(payload)
        .then(function (result) {
          if (result.error) throw result.error;
          showAddLeaveError('');
          closeAddLeaveModal();
          loadLeaveRecords();
          showLeaveSuccessMessage();
        })
        .catch(function (err) {
          var message = (err && err.message) ? err.message : 'Could not save leave. Run supabase-setup.sql to create the leave_records table.';
          showAddLeaveError(message);
        });
    } else {
      payload.id = 'leave-' + Date.now();
      payload.created_at = new Date().toISOString();
      allLeaveRecords.unshift(payload);
      try {
        localStorage.setItem('abba_leave_records', JSON.stringify(allLeaveRecords));
      } catch (e) {
        showAddLeaveError('Could not save to browser storage.');
        return;
      }
      showAddLeaveError('');
      closeAddLeaveModal();
      showLeaveSuccessMessage();
    }
  }

  window.abbaCloseEmployeeViewModal = closeEmployeeViewModal;
  window.abbaCloseAddLeaveModal = closeAddLeaveModal;
  window.abbaSaveLeave = saveLeaveForm;

  function saveEmployeeForm() {
    var id = employeeIdInput ? employeeIdInput.value : '';
    var name = document.getElementById('empName');
    var nameErr = document.getElementById('empNameError');
    if (nameErr) nameErr.textContent = '';
    if (!name || !name.value.trim()) {
      if (nameErr) nameErr.textContent = 'Name is required';
      return;
    }
    var stillWorkingEl = document.getElementById('empStillWorking');
    var joinDateEl = document.getElementById('empJoinDate');
    var endDateEl = document.getElementById('empEndDate');
    var isActive = stillWorkingEl ? stillWorkingEl.checked : true;
    var joinDate = (joinDateEl && joinDateEl.value) ? joinDateEl.value : null;
    var endDate = (!isActive && endDateEl && endDateEl.value) ? endDateEl.value : null;
    var emp = {
      name: name.value.trim(),
      phone: (document.getElementById('empPhone') && document.getElementById('empPhone').value) ? document.getElementById('empPhone').value.trim() : '',
      email: (document.getElementById('empEmail') && document.getElementById('empEmail').value) ? document.getElementById('empEmail').value.trim() : '',
      branch: (document.getElementById('empBranch') && document.getElementById('empBranch').value) || 'panadura',
      role: (document.getElementById('empRole') && document.getElementById('empRole').value) || 'staff',
      join_date: joinDate,
      end_date: endDate,
      is_active: isActive
    };
    function showEmployeeSuccessMessage() {
      var msgEl = document.getElementById('employeeMessage');
      if (msgEl) {
        msgEl.textContent = 'Employee saved successfully.';
        msgEl.hidden = false;
        msgEl.classList.remove('employee-message--error');
        msgEl.classList.add('employee-message--success');
        window.clearTimeout(window._employeeMsgTimer);
        window._employeeMsgTimer = window.setTimeout(function () {
          msgEl.hidden = true;
          msgEl.textContent = '';
        }, 4000);
      }
    }

    if (supabase) {
      if (id) {
        supabase.from('employees').update(emp).eq('id', id)
          .then(function (result) {
            if (result.error) throw result.error;
            closeEmployeeModal();
            loadEmployees();
            showEmployeeSuccessMessage();
          })
          .catch(function (err) {
            if (nameErr) nameErr.textContent = err.message || 'Update failed';
          });
      } else {
        supabase.from('employees').insert(emp)
          .then(function (result) {
            if (result.error) throw result.error;
            closeEmployeeModal();
            loadEmployees();
            showEmployeeSuccessMessage();
          })
          .catch(function (err) {
            if (nameErr) nameErr.textContent = err.message || 'Insert failed';
          });
      }
    } else {
      if (id) {
        var idx = allEmployees.findIndex(function (e) { return e.id === id; });
        if (idx >= 0) {
          allEmployees[idx] = { id: id, ...emp, created_at: allEmployees[idx].created_at };
        }
      } else {
        emp.id = 'local-' + Date.now();
        emp.created_at = new Date().toISOString();
        allEmployees.unshift(emp);
      }
      try { localStorage.setItem('abba_employees', JSON.stringify(allEmployees)); } catch (e) {}
      closeEmployeeModal();
      renderEmployees();
      showEmployeeSuccessMessage();
    }
  }

  window.abbaCloseEmployeeModal = closeEmployeeModal;
  window.abbaSaveEmployee = saveEmployeeForm;

  if (document.getElementById('employeeAddBtn')) {
    document.getElementById('employeeAddBtn').addEventListener('click', function () { openEmployeeModal(null); });
  }
  if (document.getElementById('addLeaveBtn')) {
    document.getElementById('addLeaveBtn').addEventListener('click', openAddLeaveModal);
  }
  if (employeeModal) {
    employeeModal.addEventListener('click', function (e) {
      if (e.target === employeeModal) closeEmployeeModal();
    });
  }
  var empStillWorkingEl = document.getElementById('empStillWorking');
  if (empStillWorkingEl) {
    empStillWorkingEl.addEventListener('change', toggleEndDateFromStillWorking);
  }
  if (employeeViewModal) {
    employeeViewModal.addEventListener('click', function (e) {
      if (e.target === employeeViewModal) closeEmployeeViewModal();
    });
  }
  if (addLeaveModal) {
    addLeaveModal.addEventListener('click', function (e) {
      if (e.target === addLeaveModal) closeAddLeaveModal();
    });
  }
  if (orderViewModal) {
    orderViewModal.addEventListener('click', function (e) {
      if (e.target === orderViewModal) closeOrderViewModal();
    });
  }
  if (returnConfirmModal) {
    returnConfirmModal.addEventListener('click', function (e) {
      if (e.target === returnConfirmModal) closeReturnConfirmModal();
    });
  }
  function setDateInputToToday(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var t = new Date();
    var todayStr = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    el.value = todayStr;
  }
  function setAllDateRangeDefaultsToToday() {
    setDateInputToToday('orderHistoryFrom');
    setDateInputToToday('orderHistoryTo');
    setDateInputToToday('salesReportFrom');
    setDateInputToToday('salesReportTo');
    setDateInputToToday('leaveReportDate');
  }
  setAllDateRangeDefaultsToToday();

  var orderHistoryFromEl = document.getElementById('orderHistoryFrom');
  var orderHistoryToEl = document.getElementById('orderHistoryTo');
  var orderHistoryStatusEl = document.getElementById('orderHistoryStatus');
  var orderHistorySearchEl = document.getElementById('orderHistorySearch');
  function applyOrderHistoryFilters() { renderOrderHistory(getOrderHistoryFiltered()); }
  function onOrderHistoryFilterChange() { orderHistoryPage = 1; applyOrderHistoryFilters(); }
  if (orderHistoryFromEl) orderHistoryFromEl.addEventListener('change', onOrderHistoryFilterChange);
  if (orderHistoryToEl) orderHistoryToEl.addEventListener('change', onOrderHistoryFilterChange);
  if (orderHistoryStatusEl) orderHistoryStatusEl.addEventListener('change', onOrderHistoryFilterChange);
  if (orderHistorySearchEl) orderHistorySearchEl.addEventListener('input', onOrderHistoryFilterChange);
  var leaveReportDateEl = document.getElementById('leaveReportDate');
  var leaveReportBranchEl = document.getElementById('leaveReportBranch');
  if (leaveReportDateEl) leaveReportDateEl.addEventListener('change', function () { leaveReportPage = 1; renderLeaveReport(); });
  if (leaveReportBranchEl) leaveReportBranchEl.addEventListener('change', function () { leaveReportPage = 1; renderLeaveReport(); });
  var salesReportFromEl = document.getElementById('salesReportFrom');
  var salesReportToEl = document.getElementById('salesReportTo');
  if (salesReportFromEl) salesReportFromEl.addEventListener('change', function () { renderSalesByBranch(allOrders); });
  if (salesReportToEl) salesReportToEl.addEventListener('change', function () { renderSalesByBranch(allOrders); });

  var employeeSearchEl = document.getElementById('employeeSearch');
  if (employeeSearchEl) employeeSearchEl.addEventListener('input', function () { employeePage = 1; renderEmployees(); });

  function deleteEmployee(id) {
    if (!id || !confirm('Remove this employee?')) return;
    if (supabase) {
      supabase.from('employees').delete().eq('id', id)
        .then(function (result) {
          if (result.error) throw result.error;
          loadEmployees();
        })
        .catch(function () {});
    } else {
      allEmployees = allEmployees.filter(function (e) { return e.id !== id; });
      try { localStorage.setItem('abba_employees', JSON.stringify(allEmployees)); } catch (e) {}
      renderEmployees();
    }
  }

  if (isAdmin) loadEmployees();

  // Set order ID on first load (order-create is the default panel)
  setNewOrderIdDisplay();
})();
