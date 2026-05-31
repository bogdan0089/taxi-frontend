import { createRouter, createWebHistory } from 'vue-router'
import { authService } from '../services/authService.js'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import DashboardView from '../views/DashboardView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: LoginView },
    { path: '/register', component: RegisterView },
    { path: '/dashboard', component: DashboardView, meta: { requiresAuth: true } },
  ],
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !authService.isAuthenticated()) {
    return '/'
  }
  if ((to.path === '/' || to.path === '/register') && authService.isAuthenticated()) {
    return '/dashboard'
  }
})

export default router
