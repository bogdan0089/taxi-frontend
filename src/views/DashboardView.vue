<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { authService } from '../services/authService.js'
import { userService } from '../services/userService.js'
import { tripService } from '../services/tripService.js'
import MapPicker from '../components/MapPicker.vue'

const router = useRouter()

const user = ref(null)
const trips = ref([])
const loading = ref(false)
const error = ref(null)
const showOrderForm = ref(false)
let pollInterval = null

const mapPicker = ref(null)

const form = ref({
  pickup_address: '',
  dropoff_address: '',
  pickup_lat: null,
  pickup_lon: null,
  dropoff_lat: null,
  dropoff_lon: null,
})

function onPickupSelected(point) {
  if (!point) return
  form.value.pickup_lat = point.lat
  form.value.pickup_lon = point.lng
  form.value.pickup_address = point.address
}

function onDropoffSelected(point) {
  if (!point) return
  form.value.dropoff_lat = point.lat
  form.value.dropoff_lon = point.lng
  form.value.dropoff_address = point.address
}

const isDriver = computed(() => user.value?.role === 'driver')
const isPassenger = computed(() => user.value?.role === 'passenger')

onMounted(async () => {
  if (!authService.isAuthenticated()) {
    router.push('/')
    return
  }
  await loadData()
  pollInterval = setInterval(async () => {
    if (isDriver.value) {
      trips.value = await tripService.getAvailable()
    } else {
      trips.value = await tripService.getMyTrips()
    }
  }, 5000)
})

onUnmounted(() => {
  clearInterval(pollInterval)
})

async function loadData() {
  loading.value = true
  try {
    user.value = await userService.getMe()
    if (isDriver.value) {
      trips.value = await tripService.getAvailable()
    } else {
      trips.value = await tripService.getMyTrips()
    }
  } catch {
    router.push('/')
  } finally {
    loading.value = false
  }
}

async function orderTrip() {
  if (!form.value.pickup_address || !form.value.dropoff_address) return
  if (!form.value.pickup_lat || !form.value.dropoff_lat) {
    error.value = 'Виберіть точки на карті'
    return
  }
  loading.value = true
  error.value = null
  try {
    await tripService.createTrip(form.value)
    showOrderForm.value = false
    form.value = { pickup_address: '', dropoff_address: '', pickup_lat: null, pickup_lon: null, dropoff_lat: null, dropoff_lon: null }
    mapPicker.value?.reset()
    await loadData()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function acceptTrip(id) {
  try {
    await tripService.acceptTrip(id)
    await loadData()
  } catch (e) {
    error.value = e.message
  }
}

async function completeTrip(id) {
  try {
    await tripService.completeTrip(id)
    await loadData()
  } catch (e) {
    error.value = e.message
  }
}

async function cancelTrip(id) {
  try {
    await tripService.cancelTrip(id)
    await loadData()
  } catch (e) {
    error.value = e.message
  }
}

function logout() {
  authService.logout()
  router.push('/')
}

const statusLabels = {
  waiting: 'Очікує',
  in_progress: 'В дорозі',
  completed: 'Завершено',
  cancelled: 'Скасовано',
}

const statusColors = {
  waiting: '#f59e0b',
  in_progress: '#3b82f6',
  completed: '#10b981',
  cancelled: '#ef4444',
}
</script>

<template>
  <div class="page">
    <header class="header">
      <div class="header-left">
        <span class="logo">🚕 TaxiApp</span>
        <span v-if="user" class="user-info">
          {{ user.full_name }}
          <span class="role-badge" :class="user.role">{{ user.role === 'driver' ? 'Водій' : 'Пасажир' }}</span>
        </span>
      </div>
      <button @click="logout" class="logout-btn">Вийти</button>
    </header>

    <main class="main">
      <div v-if="loading && !trips.length" class="loader">
        <div class="spinner"></div>
      </div>

      <template v-else>
        <div v-if="isPassenger" class="section">
          <div class="section-header">
            <h2>Замовити поїздку</h2>
            <button @click="showOrderForm = !showOrderForm" class="btn-primary">
              {{ showOrderForm ? 'Скасувати' : '+ Нова поїздка' }}
            </button>
          </div>

          <div v-if="showOrderForm" class="order-form">
            <MapPicker
              ref="mapPicker"
              @update:pickup="onPickupSelected"
              @update:dropoff="onDropoffSelected"
            />
            <p v-if="error" class="error">{{ error }}</p>
            <button @click="orderTrip" :disabled="loading" class="btn-primary full">
              {{ loading ? 'Замовлення...' : 'Замовити' }}
            </button>
          </div>
        </div>

        <div class="section">
          <h2>{{ isDriver ? 'Доступні поїздки' : 'Мої поїздки' }}</h2>

          <div v-if="!trips.length" class="empty">
            <span>🚗</span>
            <p>{{ isDriver ? 'Немає доступних поїздок' : 'У вас ще немає поїздок' }}</p>
          </div>

          <div v-else class="trips-list">
            <div v-for="trip in trips" :key="trip.id" class="trip-card">
              <div class="trip-header">
                <span class="trip-id">#{{ trip.id }}</span>
                <span class="status-badge" :style="{ background: statusColors[trip.status] }">
                  {{ statusLabels[trip.status] }}
                </span>
              </div>

              <div class="trip-route">
                <div class="route-point">
                  <span class="dot pickup"></span>
                  <span>{{ trip.pickup_address }}</span>
                </div>
                <div class="route-line"></div>
                <div class="route-point">
                  <span class="dot dropoff"></span>
                  <span>{{ trip.dropoff_address }}</span>
                </div>
              </div>

              <div class="trip-footer">
                <span class="price">{{ trip.price }} грн</span>
                <div class="trip-actions">
                  <button
                    v-if="isDriver && trip.status === 'waiting'"
                    @click="acceptTrip(trip.id)"
                    class="btn-sm btn-blue"
                  >Прийняти</button>
                  <button
                    v-if="isDriver && trip.status === 'in_progress'"
                    @click="completeTrip(trip.id)"
                    class="btn-sm btn-green"
                  >Завершити</button>
                  <button
                    v-if="trip.status === 'waiting'"
                    @click="cancelTrip(trip.id)"
                    class="btn-sm btn-red"
                  >Скасувати</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f0f2f5;
}

.header {
  background: #fff;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.logo {
  font-size: 1.3rem;
  font-weight: 700;
  color: #1a1a2e;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #555;
  font-size: 0.95rem;
}

.role-badge {
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
}

.role-badge.driver { background: #dbeafe; color: #1d4ed8; }
.role-badge.passenger { background: #d1fae5; color: #065f46; }

.logout-btn {
  padding: 0.4rem 1rem;
  border: 1.5px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
  color: #555;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.logout-btn:hover {
  border-color: #ef4444;
  color: #ef4444;
}

.main {
  max-width: 720px;
  margin: 2rem auto;
  padding: 0 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section {
  background: #fff;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

h2 {
  font-size: 1.1rem;
  font-weight: 700;
  color: #1a1a2e;
}

.order-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #f0f0f0;
  animation: fadeIn 0.3s ease;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #555;
}

.field input {
  padding: 0.65rem 1rem;
  border: 1.5px solid #e0e0e0;
  border-radius: 10px;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;
}

.field input:focus { border-color: #4f46e5; }

.btn-primary {
  padding: 0.6rem 1.2rem;
  background: #4f46e5;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover { background: #4338ca; }
.btn-primary.full { width: 100%; padding: 0.75rem; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.trips-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.trip-card {
  border: 1.5px solid #f0f0f0;
  border-radius: 12px;
  padding: 1rem;
  transition: box-shadow 0.2s;
  animation: fadeIn 0.3s ease;
}

.trip-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }

.trip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.trip-id { font-size: 0.85rem; color: #999; font-weight: 600; }

.status-badge {
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #fff;
}

.trip-route {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 0.75rem;
}

.route-point {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: #333;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot.pickup { background: #4f46e5; }
.dot.dropoff { background: #10b981; }

.route-line {
  width: 2px;
  height: 16px;
  background: #e0e0e0;
  margin-left: 4px;
}

.trip-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.price { font-weight: 700; color: #1a1a2e; }

.trip-actions { display: flex; gap: 8px; }

.btn-sm {
  padding: 4px 12px;
  border: none;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-sm:hover { opacity: 0.85; }
.btn-blue { background: #dbeafe; color: #1d4ed8; }
.btn-green { background: #d1fae5; color: #065f46; }
.btn-red { background: #fee2e2; color: #b91c1c; }

.empty {
  text-align: center;
  padding: 2rem;
  color: #999;
}

.empty span { font-size: 2.5rem; }
.empty p { margin-top: 0.5rem; }

.loader {
  display: flex;
  justify-content: center;
  padding: 3rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e0e0e0;
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.error {
  color: #ef4444;
  font-size: 0.85rem;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
