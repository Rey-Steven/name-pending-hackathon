import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

// Import views
import Dashboard from './views/Dashboard.vue'
import LeadForm from './views/LeadForm.vue'
import DealView from './views/DealView.vue'
import CompanySetup from './views/CompanySetup.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/setup', component: CompanySetup },
    { path: '/dashboard', component: Dashboard },
    { path: '/leads/new', component: LeadForm },
    { path: '/deals/:id', component: DealView },
  ],
})

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.use(router)

// Navigation guard: redirect to /setup if company is not configured
import { useCompanyStore } from './stores/company'

let setupChecked = false

router.beforeEach(async (to) => {
  // Always allow access to the setup page itself
  if (to.path === '/setup') return true

  // Only check once per session to avoid repeated API calls
  if (!setupChecked) {
    const companyStore = useCompanyStore()
    const isSetup = await companyStore.checkSetupStatus()
    setupChecked = true
    if (!isSetup) {
      return '/setup'
    }
    // Preload profile for nav bar display
    await companyStore.fetchProfile()
  }

  return true
})

app.mount('#app')
