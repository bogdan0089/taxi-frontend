<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({ iconUrl: markerIcon, shadowUrl: markerShadow })

const emit = defineEmits(['update:pickup', 'update:dropoff'])

const mapRef = ref(null)
const pickupInput = ref('')
const dropoffInput = ref('')
const pickupSuggestions = ref([])
const dropoffSuggestions = ref([])
let map = null
let pickupMarker = null
let dropoffMarker = null
let searchTimeout = null

onMounted(() => {
  map = L.map(mapRef.value).setView([50.4501, 30.5234], 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
  }).addTo(map)
})

onUnmounted(() => {
  if (map) map.remove()
})

async function search(query) {
  if (query.length < 3) return []
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=uk`
  const res = await fetch(url, { headers: { 'Accept-Language': 'uk' } })
  return await res.json()
}

function onPickupInput() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(async () => {
    pickupSuggestions.value = await search(pickupInput.value)
  }, 400)
}

function onDropoffInput() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(async () => {
    dropoffSuggestions.value = await search(dropoffInput.value)
  }, 400)
}

function selectPickup(place) {
  pickupInput.value = place.display_name
  pickupSuggestions.value = []
  const lat = parseFloat(place.lat)
  const lng = parseFloat(place.lon)
  if (pickupMarker) pickupMarker.remove()
  pickupMarker = L.marker([lat, lng]).addTo(map).bindPopup('📍 Відправлення').openPopup()
  map.setView([lat, lng], 14)
  emit('update:pickup', { lat, lng, address: place.display_name })
}

function selectDropoff(place) {
  dropoffInput.value = place.display_name
  dropoffSuggestions.value = []
  const lat = parseFloat(place.lat)
  const lng = parseFloat(place.lon)
  if (dropoffMarker) dropoffMarker.remove()
  dropoffMarker = L.marker([lat, lng]).addTo(map).bindPopup('🏁 Призначення').openPopup()
  map.setView([lat, lng], 14)
  emit('update:dropoff', { lat, lng, address: place.display_name })
}

function reset() {
  pickupInput.value = ''
  dropoffInput.value = ''
  pickupSuggestions.value = []
  dropoffSuggestions.value = []
  if (pickupMarker) { pickupMarker.remove(); pickupMarker = null }
  if (dropoffMarker) { dropoffMarker.remove(); dropoffMarker = null }
  emit('update:pickup', null)
  emit('update:dropoff', null)
}

defineExpose({ reset, pickupInput, dropoffInput })
</script>

<template>
  <div class="map-picker">
    <div class="inputs">
      <div class="input-group">
        <label>📍 Звідки</label>
        <input
          v-model="pickupInput"
          @input="onPickupInput"
          placeholder="Введіть адресу відправлення..."
          autocomplete="off"
        />
        <ul v-if="pickupSuggestions.length" class="suggestions">
          <li v-for="place in pickupSuggestions" :key="place.place_id" @click="selectPickup(place)">
            {{ place.display_name }}
          </li>
        </ul>
      </div>

      <div class="input-group">
        <label>🏁 Куди</label>
        <input
          v-model="dropoffInput"
          @input="onDropoffInput"
          placeholder="Введіть адресу призначення..."
          autocomplete="off"
        />
        <ul v-if="dropoffSuggestions.length" class="suggestions">
          <li v-for="place in dropoffSuggestions" :key="place.place_id" @click="selectDropoff(place)">
            {{ place.display_name }}
          </li>
        </ul>
      </div>
    </div>

    <div ref="mapRef" class="map"></div>
  </div>
</template>

<style scoped>
.map-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.inputs {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.input-group {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #555;
}

.input-group input {
  padding: 0.65rem 1rem;
  border: 1.5px solid #e0e0e0;
  border-radius: 10px;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
}

.input-group input:focus { border-color: #4f46e5; }

.suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #fff;
  border: 1.5px solid #e0e0e0;
  border-radius: 10px;
  margin-top: 4px;
  z-index: 1000;
  list-style: none;
  padding: 4px 0;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  max-height: 200px;
  overflow-y: auto;
}

.suggestions li {
  padding: 8px 12px;
  font-size: 0.85rem;
  color: #333;
  cursor: pointer;
  transition: background 0.15s;
}

.suggestions li:hover { background: #f0f4ff; }

.map {
  height: 280px;
  border-radius: 12px;
  overflow: hidden;
  border: 1.5px solid #e0e0e0;
}
</style>
