const API_URL = import.meta.env.VITE_API_URL

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.detail || 'Помилка запиту')
  }
  return response.json()
}

export const authService = {
  async register(full_name, email, password, role) {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ full_name, email, password, role }),
    })
  },

  async login(email, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    // Зберігаємо обидва токени
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    return data
  },

  // Оновлює access token через refresh token
  async refresh() {
    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) throw new Error('No refresh token')
    const data = await request(`/auth/refresh/${refreshToken}`, { method: 'POST' })
    localStorage.setItem('token', data.access_token)
    return data.access_token
  },

  logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
  },

  getToken() {
    return localStorage.getItem('token')
  },

  isAuthenticated() {
    return !!localStorage.getItem('token')
  },
}
