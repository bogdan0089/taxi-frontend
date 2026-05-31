<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authService } from '../services/authService.js'

const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref(null)
const loading = ref(false)

async function handleLogin() {
  error.value = null
  loading.value = true
  try {
    await authService.login(email.value, password.value)
    router.push('/dashboard')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h2 class="login-title">Вхід</h2>

      <div class="field">
        <label>Email</label>
        <input v-model="email" type="email" placeholder="your@email.com" />
      </div>

      <div class="field">
        <label>Пароль</label>
        <input v-model="password" type="password" placeholder="••••••••" />
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <button @click="handleLogin" :disabled="loading" class="btn">
        {{ loading ? 'Завантаження...' : 'Увійти' }}
      </button>

      <p class="footer-text">
        Немає акаунту?
        <a @click="router.push('/register')" class="link">Зареєструватись</a>
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f2f5;
}

.login-card {
  background: #fff;
  padding: 2.5rem;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.login-title {
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
