<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authService } from '../services/authService.js'

const router = useRouter()

const fullName = ref('')
const email = ref('')
const password = ref('')
const role = ref('passenger')
const error = ref(null)
const loading = ref(false)

async function handleRegister() {
  error.value = null
  loading.value = true
  try {
    await authService.register(fullName.value, email.value, password.value, role.value)
    router.push('/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="card">
      <h2 class="title">Реєстрація</h2>

      <div class="field">
        <label>Повне ім'я</label>
        <input v-model="fullName" type="text" placeholder="Іван Петренко" />
      </div>

      <div class="field">
        <label>Email</label>
        <input v-model="email" type="email" placeholder="your@email.com" />
      </div>

      <div class="field">
        <label>Пароль</label>
        <input v-model="password" type="password" placeholder="мін. 8 символів" />
      </div>

      <div class="field">
        <label>Роль</label>
        <div class="role-toggle">
          <button
            :class="['role-btn', { active: role === 'passenger' }]"
            @click="role = 'passenger'"
            type="button"
          >
            Пасажир
          </button>
          <button
            :class="['role-btn', { active: role === 'driver' }]"
            @click="role = 'driver'"
            type="button"
          >
            Водій
          </button>
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <button @click="handleRegister" :disabled="loading" class="btn">
        {{ loading ? 'Реєстрація...' : 'Зареєструватись' }}
      </button>

      <p class="footer-text">
        Вже є акаунт?
        <a @click="router.push('/')" class="link">Увійти</a>
      </p>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f2f5;
}

.card {
  background: #fff;
  padding: 2.5rem;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  text-align: center;
  color: #1a1a2e;
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

.field input:focus {
  border-color: #4f46e5;
}

.role-toggle {
  display: flex;
  gap: 8px;
}

.role-btn {
  flex: 1;
  padding: 0.6rem;
  border: 1.5px solid #e0e0e0;
  border-radius: 10px;
  background: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  color: #555;
  cursor: pointer;
  transition: all 0.2s;
}

.role-btn.active {
  background: #4f46e5;
  border-color: #4f46e5;
  color: #fff;
}

.btn {
  padding: 0.75rem;
  background: #4f46e5;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
}

.btn:hover {
  background: #4338ca;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #e53935;
  font-size: 0.85rem;
  text-align: center;
}

.footer-text {
  text-align: center;
  font-size: 0.85rem;
  color: #777;
}

.link {
  color: #4f46e5;
  font-weight: 600;
  cursor: pointer;
}

.link:hover {
  text-decoration: underline;
}
</style>
