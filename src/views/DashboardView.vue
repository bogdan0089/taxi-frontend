<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { authService } from '../services/authService.js'
import { userService } from '../services/userService.js'
import { tripService } from '../services/tripService.js'

L.Icon.Default.mergeOptions({ iconUrl: markerIcon, shadowUrl: markerShadow })

const router = useRouter()

// State
const user = ref(null)
const trips = ref([])
const loading = ref(false)
const error = ref(null)
const success = ref(null)

// Map
const mapRef = ref(null)
let map = null
let pickupMarker = null
let dropoffMarker = null

// Trip form
const showOrderForm = ref(false)
const pickupInput = ref('')
const dropoffInput = ref('')
const pickupSuggestions = ref([])
const dropoffSuggestions = ref([])
const form = ref({ pickup_address: '', dropoff_address: '', pickup_lat: null, pickup_lon: null, dropoff_lat: null, dropoff_lon: null })
let searchTimeout = null

// Profile drawer
const drawerTab = ref('main')
const editName = ref('')
const paymentId = ref('')
const showPaymentInput = ref(false)

// Polling
let pollInterval = null

const isDriver = computed(() => user.value?.role === 'driver')
const completedTrips = computed(() => trips.value.filter(t => t.status === 'completed'))
const totalEarned = computed(() => completedTrips.value.reduce((s, t) => s + (t.price || 0), 0).toFixed(2))
const activeTrip = computed(() => trips.value.find(t => ['waiting', 'in_progress'].includes(t.status)))
const driver = ref(null)
const ratingScore = ref(0)
const ratingTripId = ref(null)
const ratingDriverId = ref(null)
const ratingSubmitted = ref(false)

onMounted(async () => {
  if (!authService.isAuthenticated()) { router.push('/'); return }
  await loadData()
  initMap()
  pollInterval = setInterval(refreshTrips, 5000)
})

onUnmounted(() => {
  clearInterval(pollInterval)
  if (map) map.remove()
})

async function loadData() {
  loading.value = true
  try {
    user.value = await userService.getMe()
    editName.value = user.value.full_name
    await refreshTrips()
  } catch { router.push('/') }
  finally { loading.value = false }
}

async function refreshTrips() {
  try {
    const prev = activeTrip.value
    trips.value = isDriver.value ? await tripService.getAvailable() : await tripService.getMyTrips()
    if (!isDriver.value && activeTrip.value?.driver_id) {
      driver.value = await userService.getUser(activeTrip.value.driver_id)
    } else {
      driver.value = null
    }
    // Відкриваємо форму оцінки якщо поїздка щойно завершилась
    if (!isDriver.value && prev?.status === 'in_progress') {
      const justCompleted = trips.value.find(t => t.id === prev.id && t.status === 'completed')
      if (justCompleted && !ratingSubmitted.value) {
        ratingTripId.value = justCompleted.id
        ratingDriverId.value = justCompleted.driver_id
        ratingScore.value = 0
      }
    }
  } catch {}
}

function initMap() {
  map = L.map(mapRef.value, { zoomControl: false }).setView([50.4501, 30.5234], 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map)
}

// Geocoding
async function searchAddress(query) {
  if (query.length < 3) return []
  const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`, { headers: { 'Accept-Language': 'uk' } })
  return res.json()
}

function onPickupInput() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(async () => { pickupSuggestions.value = await searchAddress(pickupInput.value) }, 400)
}

function onDropoffInput() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(async () => { dropoffSuggestions.value = await searchAddress(dropoffInput.value) }, 400)
}

function selectPickup(place) {
  pickupInput.value = place.display_name
  pickupSuggestions.value = []
  const lat = parseFloat(place.lat), lng = parseFloat(place.lon)
  form.value = { ...form.value, pickup_address: place.display_name, pickup_lat: lat, pickup_lon: lng }
  if (pickupMarker) pickupMarker.remove()
  pickupMarker = L.marker([lat, lng]).addTo(map).bindPopup('📍 Відправлення').openPopup()
  map.setView([lat, lng], 14)
}

function selectDropoff(place) {
  dropoffInput.value = place.display_name
  dropoffSuggestions.value = []
  const lat = parseFloat(place.lat), lng = parseFloat(place.lon)
  form.value = { ...form.value, dropoff_address: place.display_name, dropoff_lat: lat, dropoff_lon: lng }
  if (dropoffMarker) dropoffMarker.remove()
  dropoffMarker = L.marker([lat, lng]).addTo(map).bindPopup('🏁 Призначення').openPopup()
  if (pickupMarker) map.fitBounds([pickupMarker.getLatLng(), dropoffMarker.getLatLng()])
}

async function orderTrip() {
  if (!form.value.pickup_lat || !form.value.dropoff_lat) { error.value = 'Виберіть адреси зі списку'; return }
  error.value = null
  loading.value = true
  try {
    await tripService.createTrip(form.value)
    showOrderForm.value = false
    pickupInput.value = ''; dropoffInput.value = ''
    form.value = { pickup_address: '', dropoff_address: '', pickup_lat: null, pickup_lon: null, dropoff_lat: null, dropoff_lon: null }
    if (pickupMarker) { pickupMarker.remove(); pickupMarker = null }
    if (dropoffMarker) { dropoffMarker.remove(); dropoffMarker = null }
    await refreshTrips()
    success.value = 'Поїздку замовлено!'
    setTimeout(() => success.value = null, 3000)
  } catch (e) { error.value = e.message }
  finally { loading.value = false }
}

async function acceptTrip(id) {
  try { await tripService.acceptTrip(id); await refreshTrips() } catch (e) { error.value = e.message }
}

async function completeTrip(id) {
  try { await tripService.completeTrip(id); await refreshTrips() } catch (e) { error.value = e.message }
}

async function cancelTrip(id) {
  try { await tripService.cancelTrip(id); await refreshTrips() } catch (e) { error.value = e.message }
}

async function saveProfile() {
  try {
    user.value = await userService.updateMe({ full_name: editName.value })
    success.value = 'Профіль оновлено'
    setTimeout(() => success.value = null, 3000)
  } catch (e) { error.value = e.message }
}

async function savePayment() {
  try {
    await userService.savePaymentMethod(paymentId.value)
    user.value = await userService.getMe()
    success.value = 'Картку збережено'
    showPaymentInput.value = false
    paymentId.value = ''
    setTimeout(() => success.value = null, 3000)
  } catch (e) { error.value = e.message }
}

function logout() { authService.logout(); router.push('/') }

async function submitRating() {
  if (!ratingScore.value || !ratingTripId.value) return
  try {
    const token = authService.getToken()
    await fetch(`${import.meta.env.VITE_API_URL}/ratings/?trip_id=${ratingTripId.value}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ driver_id: ratingDriverId.value, score: ratingScore.value }),
    })
    ratingSubmitted.value = true
    ratingTripId.value = null
    success.value = 'Оцінку збережено!'
    setTimeout(() => success.value = null, 3000)
  } catch (e) { error.value = e.message }
}

const statusLabel = { waiting: 'Очікує', in_progress: 'В дорозі', completed: 'Завершено', cancelled: 'Скасовано' }
const statusColor = { waiting: '#f59e0b', in_progress: '#3b82f6', completed: '#10b981', cancelled: '#ef4444' }
</script>

<template>
  <div class="app">
    <!-- MAP -->
    <div ref="mapRef" class="map"></div>

    <!-- MAP OVERLAY UI -->
    <div class="map-ui">
      <div class="map-logo">🚕 TaxiApp</div>
      <div class="zoom-controls">
        <button @click="map?.zoomIn()" class="zoom-btn">+</button>
        <button @click="map?.zoomOut()" class="zoom-btn">−</button>
      </div>
    </div>


    <!-- RIGHT PANEL -->
    <div class="panel">

      <!-- PANEL HEADER -->
      <div class="panel-header">
        <div class="user-info" v-if="user">
          <div class="user-initials">{{ user.full_name?.charAt(0).toUpperCase() }}</div>
          <div>
            <div class="user-name">{{ user.full_name }}</div>
            <div class="user-role">{{ isDriver ? 'Водій' : 'Пасажир' }}</div>
          </div>
        </div>
        <div class="panel-tabs">
          <button :class="['ptab', { active: drawerTab === 'main' }]" @click="drawerTab = 'main'">
            {{ isDriver ? '🚕 Поїздки' : '🗺 Замовлення' }}
          </button>
          <button :class="['ptab', { active: drawerTab === 'history' }]" @click="drawerTab = 'history'">🕐 Історія</button>
          <button :class="['ptab', { active: drawerTab === 'profile' }]" @click="drawerTab = 'profile'">👤 Профіль</button>
        </div>
      </div>

      <!-- NOTIFICATIONS -->
      <div v-if="success" class="alert-success">✅ {{ success }}</div>
      <div v-if="error" class="alert-error">❌ {{ error }}</div>

      <!-- TAB: MAIN -->
      <div v-if="drawerTab === 'main'">

        <!-- PASSENGER VIEW -->
        <template v-if="!isDriver">
          <div v-if="activeTrip" class="active-trip">
            <div class="active-trip-header">
              <span class="status-dot" :style="{ background: statusColor[activeTrip.status] }"></span>
              <span class="status-text">{{ statusLabel[activeTrip.status] }}</span>
              <span class="trip-price">{{ activeTrip.price }} ₴</span>
            </div>
            <div class="route-row"><span class="dot blue"></span><span class="addr">{{ activeTrip.pickup_address?.split(',')[0] }}</span></div>
            <div class="route-row"><span class="dot green"></span><span class="addr">{{ activeTrip.dropoff_address?.split(',')[0] }}</span></div>

            <!-- Картка водія -->
            <div v-if="driver && activeTrip.status === 'in_progress'" class="driver-card">
              <div class="driver-avatar">{{ driver.full_name?.charAt(0).toUpperCase() }}</div>
              <div class="driver-info">
                <div class="driver-name">{{ driver.full_name }}</div>
                <div class="driver-rating">⭐ {{ driver.avg_rating?.toFixed(1) || '0.0' }}</div>
              </div>
            </div>

            <button v-if="activeTrip.status === 'waiting'" @click="cancelTrip(activeTrip.id)" class="btn-cancel">Скасувати поїздку</button>
          </div>

          <!-- Форма оцінки -->
          <div v-if="ratingTripId" class="rating-form">
            <div class="rating-title">Оцініть водія</div>
            <div class="stars">
              <span v-for="n in 5" :key="n" class="star" :class="{ active: n <= ratingScore }" @click="ratingScore = n">★</span>
            </div>
            <button @click="submitRating" :disabled="!ratingScore" class="btn-primary full">Надіслати оцінку</button>
            <button @click="ratingTripId = null" class="btn-ghost">Пропустити</button>
          </div>

          <div v-else class="order-section">
            <button v-if="!showOrderForm" @click="showOrderForm = true" class="btn-order">🚕 Замовити поїздку</button>
            <div v-else class="order-form">
              <div class="input-group">
                <span class="input-icon">📍</span>
                <div class="input-wrap">
                  <input v-model="pickupInput" @input="onPickupInput" placeholder="Звідки?" autocomplete="off" />
                  <ul v-if="pickupSuggestions.length" class="suggestions">
                    <li v-for="p in pickupSuggestions" :key="p.place_id" @click="selectPickup(p)">{{ p.display_name }}</li>
                  </ul>
                </div>
              </div>
              <div class="input-group">
                <span class="input-icon">🏁</span>
                <div class="input-wrap">
                  <input v-model="dropoffInput" @input="onDropoffInput" placeholder="Куди?" autocomplete="off" />
                  <ul v-if="dropoffSuggestions.length" class="suggestions">
                    <li v-for="p in dropoffSuggestions" :key="p.place_id" @click="selectDropoff(p)">{{ p.display_name }}</li>
                  </ul>
                </div>
              </div>
              <div class="form-actions">
                <button @click="showOrderForm = false" class="btn-ghost">Скасувати</button>
                <button @click="orderTrip" :disabled="loading" class="btn-primary">{{ loading ? '...' : 'Замовити' }}</button>
              </div>
            </div>
          </div>
        </template>

        <!-- DRIVER VIEW -->
        <template v-else>
          <div v-if="!trips.length" class="empty">Немає доступних поїздок</div>
          <div v-else class="trips-list">
            <div v-for="trip in trips" :key="trip.id" class="trip-card">
              <div class="route-row"><span class="dot blue"></span><span class="addr">{{ trip.pickup_address?.split(',')[0] }}</span></div>
              <div class="route-row"><span class="dot green"></span><span class="addr">{{ trip.dropoff_address?.split(',')[0] }}</span></div>
              <div class="card-footer">
                <span class="trip-price">{{ trip.price }} ₴</span>
                <div class="card-actions">
                  <button v-if="trip.status === 'waiting'" @click="acceptTrip(trip.id)" class="btn-sm blue">Прийняти</button>
                  <button v-if="trip.status === 'in_progress'" @click="completeTrip(trip.id)" class="btn-sm green">Завершити</button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- TAB: HISTORY -->
      <div v-if="drawerTab === 'history'">
        <div v-if="!trips.length" class="empty">Поїздок ще немає</div>
        <div v-else class="trips-list">
          <div v-for="t in trips" :key="t.id" class="trip-card">
            <div class="route-row"><span class="dot blue"></span><span class="addr">{{ t.pickup_address?.split(',')[0] }}</span></div>
            <div class="route-row"><span class="dot green"></span><span class="addr">{{ t.dropoff_address?.split(',')[0] }}</span></div>
            <div class="card-footer">
              <span class="status-pill" :style="{ background: statusColor[t.status] }">{{ statusLabel[t.status] }}</span>
              <span class="trip-price">{{ t.price }} ₴</span>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB: PROFILE -->
      <div v-if="drawerTab === 'profile'" class="profile-section">
        <div class="stats-row">
          <div class="stat"><span class="stat-val">{{ completedTrips.length }}</span><span class="stat-lbl">Поїздок</span></div>
          <div class="stat" v-if="isDriver"><span class="stat-val">⭐ {{ user?.avg_rating?.toFixed(1) || '0.0' }}</span><span class="stat-lbl">Рейтинг</span></div>
          <div class="stat" v-if="isDriver"><span class="stat-val">{{ totalEarned }} ₴</span><span class="stat-lbl">Заробіток</span></div>
        </div>

        <div class="field">
          <label>Ім'я</label>
          <input v-model="editName" />
        </div>
        <button @click="saveProfile" class="btn-primary full">Зберегти зміни</button>

        <div v-if="!isDriver" class="payment-block">
          <div class="payment-info">
            <span v-if="user?.payment_id">✅ Картку підключено</span>
            <span v-else>❌ Картка не підключена</span>
          </div>
          <button @click="showPaymentInput = !showPaymentInput" class="btn-secondary">
            {{ user?.payment_id ? 'Змінити картку' : '+ Додати картку' }}
          </button>
          <div v-if="showPaymentInput" class="payment-form">
            <p class="hint">Тест ID: <code>pm_card_visa</code></p>
            <div class="field">
              <label>Payment Method ID</label>
              <input v-model="paymentId" placeholder="pm_card_visa" />
            </div>
            <button @click="savePayment" class="btn-primary full">Зберегти</button>
          </div>
        </div>

        <button @click="logout" class="btn-logout">Вийти</button>
      </div>

    </div>
  </div>
</template>

<style scoped>
* { box-sizing: border-box; }

.app {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.map {
  flex: 1;
  height: 100%;
  z-index: 0;
  min-width: 0;
}


/* MAP UI */
.map-ui {
  position: absolute;
  top: 0; left: 0;
  width: calc(100% - 380px);
  padding: 1rem 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  z-index: 10;
  pointer-events: none;
}

.map-logo {
  font-size: 1.1rem;
  font-weight: 800;
  color: #1a1a2e;
  background: rgba(255,255,255,0.92);
  padding: 6px 14px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  pointer-events: all;
}

.zoom-controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: all;
}

.zoom-btn {
  width: 36px;
  height: 36px;
  background: rgba(255,255,255,0.92);
  border: none;
  border-radius: 10px;
  font-size: 1.2rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  color: #1a1a2e;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.zoom-btn:hover { background: #fff; }

/* TOAST */
.toast {
  position: absolute;
  top: 80px; left: calc(50% - 190px); transform: translateX(-50%);
  z-index: 20;
  padding: 0.6rem 1.2rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
}
.toast.success { background: #d1fae5; color: #065f46; }
.toast.error { background: #fee2e2; color: #b91c1c; }

/* RIGHT PANEL */
.panel {
  width: 380px;
  height: 100%;
  flex-shrink: 0;
  background: #18181b;
  color: #f4f4f5;
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  z-index: 10;
}

.panel-title {
  font-size: 1rem;
  font-weight: 700;
  color: #f4f4f5;
  margin-bottom: 0.5rem;
}

.panel-title {
  font-size: 1rem;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 1rem;
}

/* ORDER FORM */
.btn-order {
  width: 100%;
  padding: 1rem;
  background: #4f46e5;
  color: #fff;
  border: none;
  border-radius: 14px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-order:hover { background: #4338ca; }

.order-form { display: flex; flex-direction: column; gap: 0.75rem; }

.input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #27272a;
  border-radius: 12px;
  padding: 0.6rem 0.75rem;
  position: relative;
  border: 1px solid #3f3f46;
}

.input-icon { font-size: 1.1rem; flex-shrink: 0; }

.input-wrap { flex: 1; position: relative; }

.input-wrap input {
  width: 100%;
  border: none;
  background: none;
  font-size: 0.95rem;
  outline: none;
  color: #f4f4f5;
}

.input-wrap input::placeholder { color: #71717a; }

.suggestions {
  position: absolute;
  top: 100%; left: -44px; right: -12px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.12);
  z-index: 100;
  list-style: none;
  padding: 4px 0;
  margin: 4px 0 0;
  max-height: 200px;
  overflow-y: auto;
}

.suggestions li {
  padding: 8px 12px;
  font-size: 0.82rem;
  color: #333;
  cursor: pointer;
  transition: background 0.15s;
}
.suggestions li:hover { background: #f0f4ff; }

.form-actions { display: flex; gap: 0.75rem; }

.btn-primary {
  flex: 1;
  padding: 0.75rem;
  background: #4f46e5;
  color: #fff;
  border: none;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
}
.btn-primary.full { width: 100%; flex: none; }
.btn-primary:disabled { opacity: 0.6; }

.btn-ghost {
  padding: 0.75rem 1rem;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 12px;
  font-size: 0.9rem;
  cursor: pointer;
  color: #a1a1aa;
}

.rating-form {
  background: #27272a;
  border-radius: 14px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
}

.rating-title { font-weight: 700; color: #f4f4f5; font-size: 0.95rem; }

.stars { display: flex; gap: 8px; }

.star {
  font-size: 2rem;
  color: #3f3f46;
  cursor: pointer;
  transition: color 0.15s, transform 0.15s;
  user-select: none;
}
.star:hover, .star.active { color: #fbbf24; transform: scale(1.15); }

.driver-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #3f3f46;
  border-radius: 12px;
  padding: 0.75rem;
  margin-top: 4px;
}

.driver-avatar {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: #4f46e5;
  color: #fff;
  font-size: 1.1rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.driver-info { display: flex; flex-direction: column; gap: 2px; }
.driver-name { font-weight: 600; font-size: 0.9rem; color: #f4f4f5; }
.driver-rating { font-size: 0.78rem; color: #a1a1aa; }

.btn-cancel {
  width: 100%;
  margin-top: 0.75rem;
  padding: 0.65rem;
  background: #fee2e2;
  color: #b91c1c;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
}

/* ACTIVE TRIP */
.active-trip {
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 16px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.active-trip .addr { color: #d4d4d8; }

.active-trip-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.status-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

.status-text { font-weight: 700; font-size: 1rem; color: #f4f4f5; flex: 1; }
.trip-price { font-weight: 700; color: #a78bfa; }

/* ROUTE */
.route-row { display: flex; align-items: center; gap: 8px; }
.dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.dot.blue { background: #4f46e5; }
.dot.green { background: #10b981; }
.addr { font-size: 0.88rem; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* TRIPS LIST */
.trips-list { display: flex; flex-direction: column; gap: 0.75rem; }

.trip-card {
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 14px;
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.trip-card .addr { color: #d4d4d8; }
.trip-card .trip-price { color: #a78bfa; }

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
}

.card-actions { display: flex; gap: 6px; }

.btn-sm {
  padding: 4px 14px;
  border: none;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-sm.blue { background: #dbeafe; color: #1d4ed8; }
.btn-sm.green { background: #d1fae5; color: #065f46; }

.empty { text-align: center; color: #71717a; padding: 1.5rem 0; font-size: 0.9rem; }

/* PANEL HEADER */
.panel-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #3f3f46;
  margin-bottom: 1rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-initials {
  width: 44px; height: 44px;
  border-radius: 12px;
  background: #4f46e5;
  color: #fff;
  font-size: 1.2rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-name { font-weight: 700; font-size: 0.95rem; color: #f4f4f5; }
.user-role { font-size: 0.75rem; color: #71717a; margin-top: 1px; }

.panel-tabs {
  display: flex;
  gap: 4px;
  background: #27272a;
  border-radius: 10px;
  padding: 4px;
}

.ptab {
  flex: 1;
  padding: 0.5rem 0.25rem;
  border: none;
  background: none;
  font-size: 0.75rem;
  color: #71717a;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
  font-weight: 500;
}
.ptab.active { background: #4f46e5; color: #fff; font-weight: 700; }

/* ALERTS */
.alert-success {
  padding: 0.6rem 0.9rem;
  background: rgba(16,185,129,0.15);
  color: #34d399;
  border-radius: 10px;
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
}
.alert-error {
  padding: 0.6rem 0.9rem;
  background: rgba(239,68,68,0.15);
  color: #f87171;
  border-radius: 10px;
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
}

/* ORDER SECTION */
.order-section { display: flex; flex-direction: column; gap: 0.75rem; }

/* PROFILE SECTION */
.profile-section { display: flex; flex-direction: column; gap: 1rem; }

.stats-row {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}
.stat {
  flex: 1;
  background: #27272a;
  border-radius: 12px;
  padding: 0.75rem 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.stat-val { font-weight: 700; font-size: 1rem; color: #f4f4f5; }
.stat-lbl { font-size: 0.7rem; color: #71717a; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 0.82rem; font-weight: 600; color: #a1a1aa; }
.field input {
  padding: 0.65rem 0.9rem;
  border: 1px solid #3f3f46;
  background: #27272a;
  color: #f4f4f5;
  border-radius: 10px;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
}
.field input:focus { border-color: #4f46e5; }
.field input::placeholder { color: #52525b; }

.btn-secondary {
  padding: 0.5rem 1rem;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  color: #a1a1aa;
  align-self: flex-start;
  transition: all 0.2s;
}
.btn-secondary:hover { border-color: #4f46e5; color: #818cf8; }

.btn-logout {
  padding: 0.65rem;
  background: rgba(239,68,68,0.1);
  color: #f87171;
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  margin-top: auto;
}

.payment-block { display: flex; flex-direction: column; gap: 0.75rem; }
.payment-info { font-size: 0.88rem; color: #a1a1aa; }
.payment-form { display: flex; flex-direction: column; gap: 0.75rem; }

code { background: #3f3f46; padding: 2px 6px; border-radius: 4px; font-size: 0.82rem; color: #a78bfa; }
.hint { font-size: 0.82rem; color: #71717a; background: #27272a; padding: 8px 12px; border-radius: 8px; }

.status-pill { padding: 2px 8px; border-radius: 20px; font-size: 0.72rem; font-weight: 600; color: #fff; }

/* ANIMATIONS */
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-enter-active, .slide-leave-active { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.slide-enter-from, .slide-leave-to { transform: translateX(100%); }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
