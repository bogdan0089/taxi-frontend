import { authService } from './authService.js'

const API_URL = import.meta.env.VITE_API_URL

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authService.getToken()}`,
  }
}

async function authFetch(url, options = {}, retry = true) {
  const response = await fetch(url, { headers: authHeaders(), ...options })
  if (response.status === 401 && retry) {
    try {
      await authService.refresh()
      return authFetch(url, options, false)
    } catch {
      authService.logout()
      window.location.href = '/'
      return
    }
  }
  if (!response.ok) throw new Error('Помилка запиту')
  return response.json()
}

export const userService = {
  async getMe() {
    const token = authService.getToken()
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1]))
    return authFetch(`${API_URL}/users/${payload.sub}`)
  },

  async updateMe(data) {
    const token = authService.getToken()
    const payload = JSON.parse(atob(token.split('.')[1]))
    return authFetch(`${API_URL}/users/${payload.sub}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async savePaymentMethod(paymentId) {
    return authFetch(`${API_URL}/payment/method`, {
      method: 'POST',
      body: JSON.stringify({ payment_id: paymentId }),
    })
  },

  async getUser(userId) {
    return authFetch(`${API_URL}/users/${userId}`)
  },

  async getDriverRating(driverId) {
    return authFetch(`${API_URL}/ratings/driver/${driverId}/avg`)
  },
}
