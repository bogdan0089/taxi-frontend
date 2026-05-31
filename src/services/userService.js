import { authService } from './authService.js'

const API_URL = import.meta.env.VITE_API_URL

export const userService = {
  async getMe() {
    const token = authService.getToken()
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1]))
    const response = await fetch(`${API_URL}/users/${payload.sub}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    return response.json()
  },
}
