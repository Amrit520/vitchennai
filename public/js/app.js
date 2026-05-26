const state = {
  user: null,
  authMode: 'login',
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showToast(message, type = 'success') {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  setTimeout(() => toast.classList.add('hidden'), 3500);
}

function formatPrice(amount) {
  if (amount === 0) return 'Free';
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function updateAuthUI() {
  const isLoggedIn = !!state.user;
  $$('.auth-only').forEach((el) => el.classList.toggle('hidden', !isLoggedIn));
  $('#btnLogin').classList.toggle('hidden', isLoggedIn);
  if (isLoggedIn) {
    $('#userGreeting').textContent = `Hi, ${state.user.name.split(' ')[0]}`;
    $('#userGreeting').classList.remove('hidden');
  } else {
    $('#userGreeting').classList.add('hidden');
  }
}

async function initAuth() {
  if (!API.token) return;
  try {
    const { user } = await API.getMe();
    state.user = user;
    updateAuthUI();
  } catch {
    API.setToken(null);
  }
}

function openAuthModal(mode = 'login') {
  state.authMode = mode;
  $('#authTitle').textContent = mode === 'login' ? 'Sign In' : 'Create Account';
  $('#nameField').classList.toggle('hidden', mode === 'login');
  $('#authSwitchText').textContent = mode === 'login' ? "Don't have an account?" : 'Already have an account?';
  $('#authToggle').textContent = mode === 'login' ? 'Register' : 'Sign In';
  $('#authModal').classList.remove('hidden');
}

function closeAuthModal() {
  $('#authModal').classList.add('hidden');
  $('#authForm').reset();
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = Object.fromEntries(fd);

  try {
    const fn = state.authMode === 'login' ? API.login : API.register;
    const data = await fn(body);
    API.setToken(data.token);
    state.user = data.user;
    updateAuthUI();
    closeAuthModal();
    showToast(`Welcome, ${data.user.name}!`);
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleLogout() {
  try {
    await API.logout();
  } catch {
    /* ignore */
  }
  API.setToken(null);
  state.user = null;
  updateAuthUI();
  showToast('Logged out');
}

async function purchaseItem(paymentType, referenceId, title, amount) {
  if (!state.user) {
    openAuthModal('login');
    showToast('Please sign in to continue', 'error');
    return;
  }

  try {
    const orderData = await API.createOrder({
      paymentType,
      referenceId,
      idempotencyKey: `${paymentType}_${referenceId}_${state.user.id}_${Date.now()}`,
    });

    if (orderData.demoMode) {
      await API.completeDemoPayment(orderData.paymentId);
      showToast(`Enrolled in "${title}" successfully! (Demo mode)`);
      loadDashboard();
      return;
    }

    const options = {
      key: orderData.keyId,
      amount: orderData.order.amount,
      currency: orderData.order.currency,
      name: 'EduFlow LMS',
      description: title,
      order_id: orderData.order.id,
      handler: async (response) => {
        try {
          await API.verifyPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          showToast(`Payment successful for "${title}"!`);
          loadDashboard();
          loadCourses();
          loadEvents();
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
      prefill: {
        name: state.user.name,
        email: state.user.email,
      },
      theme: { color: '#6366f1' },
    };

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', (r) => {
      showToast(r.error.description || 'Payment failed', 'error');
    });
    rzp.open();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderCourseCard(course) {
  return `
    <article class="card">
      <span class="card-badge">${course.category}</span>
      <h3>${course.title}</h3>
      <p>${course.description.slice(0, 120)}...</p>
      <div class="card-meta">
        <span class="price">${formatPrice(course.price)}</span>
        <button class="btn btn-primary btn-sm" data-enroll="${course._id}" data-title="${course.title}" data-price="${course.price}">
          Enroll
        </button>
      </div>
    </article>
  `;
}

function renderEventCard(event) {
  const seats = event.capacity - event.registeredCount;
  return `
    <article class="card">
      <span class="card-badge">${event.eventType}</span>
      <h3>${event.title}</h3>
      <p>${event.description.slice(0, 120)}...</p>
      <p class="seats">${formatDate(event.startDate)} · ${event.venue}</p>
      <div class="card-meta">
        <div>
          <span class="price ${event.price === 0 ? 'free' : ''}">${formatPrice(event.price)}</span>
          <p class="seats">${seats} seats left</p>
        </div>
        <button class="btn btn-primary btn-sm" data-register="${event._id}" data-title="${event.title}" data-price="${event.price}" ${seats === 0 ? 'disabled' : ''}>
          Register
        </button>
      </div>
    </article>
  `;
}

async function loadCourses() {
  const search = $('#courseSearch').value;
  try {
    const { courses, total } = await API.getCourses({ search, limit: 12 });
    $('#statCourses').textContent = total;
    const grid = $('#coursesGrid');
    if (!courses.length) {
      grid.innerHTML = '<p class="empty-state">No courses found.</p>';
      return;
    }
    grid.innerHTML = courses.map(renderCourseCard).join('');
    grid.querySelectorAll('[data-enroll]').forEach((btn) => {
      btn.addEventListener('click', () =>
        purchaseItem('course', btn.dataset.enroll, btn.dataset.title, btn.dataset.price)
      );
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadEvents() {
  const eventType = $('#eventFilter').value;
  try {
    const params = { upcoming: 'true', limit: 12 };
    if (eventType) params.eventType = eventType;
    const { events, total } = await API.getEvents(params);
    $('#statEvents').textContent = total;
    const grid = $('#eventsGrid');
    if (!events.length) {
      grid.innerHTML = '<p class="empty-state">No upcoming events.</p>';
      return;
    }
    grid.innerHTML = events.map(renderEventCard).join('');
    grid.querySelectorAll('[data-register]').forEach((btn) => {
      btn.addEventListener('click', () =>
        purchaseItem('event', btn.dataset.register, btn.dataset.title, btn.dataset.price)
      );
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadDashboard() {
  if (!state.user) return;
  try {
    const [enrollments, events, payments] = await Promise.all([
      API.getEnrollments(),
      API.getMyEvents(),
      API.getPaymentHistory(),
    ]);

    $('#tabEnrollments').innerHTML = enrollments.enrollments?.length
      ? enrollments.enrollments
          .map(
            (e) => `
        <div class="list-item">
          <div><strong>${e.course?.title || 'Course'}</strong><br><span class="seats">Progress: ${e.progress}%</span></div>
          <span class="status captured">${e.status}</span>
        </div>`
          )
          .join('')
      : '<p class="empty-state">No enrollments yet.</p>';

    $('#tabRegistrations').innerHTML = events.events?.length
      ? events.events
          .map(
            (ev) => `
        <div class="list-item">
          <div><strong>${ev.title}</strong><br><span class="seats">${formatDate(ev.startDate)}</span></div>
          <span class="status captured">registered</span>
        </div>`
          )
          .join('')
      : '<p class="empty-state">No event registrations yet.</p>';

    $('#tabPayments').innerHTML = payments.payments?.length
      ? payments.payments
          .map(
            (p) => `
        <div class="list-item">
          <div><strong>${p.metadata?.itemTitle || p.paymentType}</strong><br><span class="seats">${formatPrice(p.amount)} · ${new Date(p.createdAt).toLocaleDateString()}</span></div>
          <span class="status ${p.status}">${p.status}</span>
        </div>`
          )
          .join('')
      : '<p class="empty-state">No payments yet.</p>';
  } catch {
    /* dashboard optional */
  }
}

function setupTabs() {
  $$('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const name = tab.dataset.tab;
      $('#tabEnrollments').classList.toggle('hidden', name !== 'enrollments');
      $('#tabRegistrations').classList.toggle('hidden', name !== 'registrations');
      $('#tabPayments').classList.toggle('hidden', name !== 'payments');
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  $('#btnLogin').addEventListener('click', () => openAuthModal('login'));
  $('#btnLogout').addEventListener('click', handleLogout);
  $('#authForm').addEventListener('submit', handleAuthSubmit);
  $('#authToggle').addEventListener('click', () =>
    openAuthModal(state.authMode === 'login' ? 'register' : 'login')
  );
  $('.modal-close').addEventListener('click', closeAuthModal);
  $('.modal-backdrop').addEventListener('click', closeAuthModal);

  $('#courseSearch').addEventListener(
    'input',
    debounce(() => loadCourses(), 400)
  );
  $('#eventFilter').addEventListener('change', loadEvents);

  setupTabs();
  await initAuth();
  await loadCourses();
  await loadEvents();
  if (state.user) loadDashboard();
});

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
