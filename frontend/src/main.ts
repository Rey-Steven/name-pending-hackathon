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
import MarketResearchView from './views/MarketResearchView.vue'
import SocialContentView from './views/SocialContentView.vue'
import LegalContracts from './views/LegalContracts.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/setup' },
    { path: '/setup', component: CompanySetup },
    { path: '/settings', component: Settings },
    { path: '/help', component: HelpCenter },
    {
      path: '/company/:companyId',
      children: [
        { path: '', redirect: { name: 'dashboard' } },
        { path: 'dashboard', name: 'dashboard', component: Dashboard },
        { path: 'leads', name: 'leads', component: LeadsList },
        { path: 'leads/new', name: 'lead-new', component: LeadForm },
        { path: 'deals', name: 'deals', component: DealsList },
        { path: 'deals/:id', name: 'deal', component: DealView },
        { path: 'tasks', name: 'tasks', component: TasksList },
        { path: 'invoices', name: 'invoices', component: InvoicesList },
        { path: 'emails', name: 'emails', component: EmailsView },
        { path: 'research', name: 'research', component: MarketResearchView },
        { path: 'content', name: 'content', component: SocialContentView },
        { path: 'legal/contracts', name: 'legal-contracts', component: LegalContracts },
      ],
    },
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
  if (to.path === '/setup' || to.path.startsWith('/setup') || to.path === '/settings' || to.path === '/help') return true

  const companyStore = useCompanyStore()

  // One-time setup check on first navigation
  if (!setupChecked) {
    const isSetup = await companyStore.checkSetupStatus()
    setupChecked = true
    if (!isSetup) {
      return '/setup'
    }
    await companyStore.fetchProfile()
  }

  // If navigating to root, redirect to active company's dashboard
  if (to.path === '/') {
    if (companyStore.activeCompanyId) {
      return `/company/${companyStore.activeCompanyId}/dashboard`
    }
    return '/setup'
  }

  // If navigating to a company route, sync the store with the URL's company ID
  const companyId = to.params.companyId as string | undefined
  if (companyId && companyId !== companyStore.activeCompanyId) {
    try {
      await companyStore.activateCompany(companyId)
    } catch {
      // Invalid company ID — redirect to setup
      return '/setup'
    }
  }

  return true
})

app.mount('#app')
