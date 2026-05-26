const API = {
  base: '/api',
  token: localStorage.getItem('token') || null,

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  },

  async request(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch(`${this.base}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  },

  register(body) {
    return this.request('/auth/register', { method: 'POST', body: JSON.stringify(body) });
  },

  login(body) {
    return this.request('/auth/login', { method: 'POST', body: JSON.stringify(body) });
  },

  getMe() {
    return this.request('/auth/me');
  },

  logout() {
    return this.request('/auth/logout', { method: 'POST' });
  },

  getCourses(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/courses?${q}`);
  },

  getEvents(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/events?${q}`);
  },

  getEventStats() {
    return this.request('/events/stats');
  },

  getEnrollments() {
    return this.request('/courses/enrollments/me');
  },

  getMyEvents() {
    return this.request('/events/my/registrations');
  },

  getPaymentHistory() {
    return this.request('/payments/history');
  },

  createOrder(body) {
    return this.request('/payments/create-order', { method: 'POST', body: JSON.stringify(body) });
  },

  verifyPayment(body) {
    return this.request('/payments/verify', { method: 'POST', body: JSON.stringify(body) });
  },

  completeDemoPayment(paymentId) {
    return this.request('/payments/demo-complete', {
      method: 'POST',
      body: JSON.stringify({ paymentId }),
    });
  },
};
