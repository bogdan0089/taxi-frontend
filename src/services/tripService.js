import { authService } from './authService.js'

const API_URL = import.meta.env.VITE_API_URL

async function authRequest(path, options = {}, retry = true) {
  const token = authService.getToken()
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
    ...options,
  })

  // Якщо 401 — пробуємо оновити токен і повторити запит один раз
  if (response.status === 401 && retry) {
    try {
      await authService.refresh()
      return authRequest(path, options, false)
    } catch {
      authService.logout()
      window.location.href = '/'
      return
    }
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.detail || 'Помилка запиту')
  }
  return response.json()
}

export const tripService = {
  createTrip(data) {
    return authRequest('/trips/', { method: 'POST', body: JSON.stringify(data) })
  },
  getMyTrips(limit = 10, offset = 0) {
    return authRequest(`/trips/my?limit=${limit}&offset=${offset}`)
  },
  getAvailable(limit = 10, offset = 0) {
    return authRequest(`/trips/available?limit=${limit}&offset=${offset}`)
  },
  acceptTrip(tripId) {
    return authRequest(`/trips/${tripId}/accept`, { method: 'POST' })
  },
  completeTrip(tripId) {
    return authRequest(`/trips/${tripId}/complete`, { method: 'POST' })
  },
  cancelTrip(tripId) {
    return authRequest(`/trips/${tripId}/cancel`, { method: 'POST' })
  },
}
