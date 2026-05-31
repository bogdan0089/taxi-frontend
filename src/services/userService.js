import { authService } from './authService.js'

const API_URL = import.meta.env.VITE_API_URL

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authService.getToken()}`,
  }
}

export const userService = {
  async getMe() {
    const token = authService.getToken()
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1]))
    const res = await fetch(`${API_URL}/users/${payload.sub}`, {
      headers: authHeaders(),
    })
    return res.json()
  },

  async updateMe(data) {
    const token = authService.getToken()
    const payload = JSON.parse(atob(token.split('.')[1]))
    const res = await fetch(`${API_URL}/users/${payload.sub}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Помилка оновлення')
    return res.json()
  },

  async savePaymentMethod(paymentId) {
    const res = await fetch(`${API_URL}/payment/method`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ payment_id: paymentId }),
    })
    if (!res.ok) throw new Error('Помилка збереження картки')
    return res.json()
  },

  async getDriverRating(driverId) {
    const res = await fetch(`${API_URL}/ratings/driver/${driverId}/avg`, {
      headers: authHeaders(),
    })
    return res.json()
  },
}
