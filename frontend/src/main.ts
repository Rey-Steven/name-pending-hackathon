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
import HelpCenter from './views/HelpCenter.vue'
import LeadsList from './views/LeadsList.vue'
import DealsList from './views/DealsList.vue'
import TasksList from './views/TasksList.vue'
import InvoicesList from './views/InvoicesList.vue'
import EmailsView from './views/EmailsView.vue'
import Settings from './views/Settings.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/setup', component: CompanySetup },
    { path: '/settings', component: Settings },
    { path: '/dashboard', component: Dashboard },
    { path: '/leads', component: LeadsList },
    { path: '/leads/new', component: LeadForm },
    { path: '/deals', component: DealsList },
    { path: '/deals/:id', component: DealView },
    { path: '/help', component: HelpCenter },
    { path: '/tasks', component: TasksList },
    { path: '/invoices', component: InvoicesList },
    { path: '/emails', component: EmailsView },
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
  // Always allow access to setup, settings, and help pages
  if (to.path === '/setup' || to.path === '/settings' || to.path === '/help') return true

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
