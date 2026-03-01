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
import LegalReviews from './views/LegalReviews.vue'
import LegalContracts from './views/LegalContracts.vue'
import GemiCompanies from './views/GemiCompanies.vue'
import ElorusContactsList from './views/ElorusContactsList.vue'
import ElorusProductsList from './views/ElorusProductsList.vue'
import ElorusOffersList from './views/ElorusOffersList.vue'
import CompanySelect from './views/CompanySelect.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/setup', component: CompanySetup },
    { path: '/select-company', component: CompanySelect },
    { path: '/settings', component: Settings },
    { path: '/gemi-companies', component: GemiCompanies },
    { path: '/help', component: HelpCenter },
    {
      path: '/company/:companyId',
      children: [
        { path: '', redirect: { name: 'dashboard' } },
        { path: 'dashboard', name: 'dashboard', component: Dashboard },
        { path: 'leads', name: 'leads', component: LeadsList },
        { path: 'leads/new', name: 'lead-new', component: LeadForm },
        { path: 'leads/:id/edit', name: 'lead-edit', component: LeadForm },
        { path: 'deals', name: 'deals', component: DealsList },
        { path: 'deals/:id', name: 'deal', component: DealView },
        { path: 'tasks', name: 'tasks', component: TasksList },
        { path: 'invoices', name: 'invoices', component: InvoicesList },
        { path: 'emails', name: 'emails', component: EmailsView },
        { path: 'research', name: 'research', component: MarketResearchView },
        { path: 'content', name: 'content', component: SocialContentView },
        { path: 'legal/reviews', name: 'legal-reviews', component: LegalReviews },
        { path: 'legal/contracts', name: 'legal-contracts', component: LegalContracts },
        { path: 'elorus-contacts', name: 'elorus-contacts', component: ElorusContactsList },
        { path: 'elorus-products', name: 'elorus-products', component: ElorusProductsList },
        { path: 'elorus-offers', name: 'elorus-offers', component: ElorusOffersList },
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

router.beforeEach(async (to) => {
  // Always allow access to setup, settings, help, and company select pages
  const openPaths = ['/setup', '/settings', '/help', '/gemi-companies', '/select-company']
  if (openPaths.some(p => to.path === p || to.path.startsWith(p + '/'))) return true

  const companyStore = useCompanyStore()

  // One-time setup check on first navigation
  if (!companyStore.setupChecked) {
    const isSetup = await companyStore.checkSetupStatus()
    companyStore.setupChecked = true

    // Backend unreachable — let navigation proceed, App.vue shows the error overlay
    if (companyStore.backendReachable === false) {
      return true
    }

    if (!isSetup) {
      // Backend is reachable but no active company — check if companies exist
      await companyStore.fetchAllCompanies()
      if (companyStore.companies.length > 0) {
        return '/select-company'
      }
      return '/setup'
    }

    await companyStore.fetchProfile()
  }

  // If navigating to root (no company in URL), show company selector
  if (to.path === '/') {
    if (companyStore.companies.length > 0) {
      return '/select-company'
    }
    return '/setup'
  }

  // If navigating to a company route, sync the store with the URL's company ID
  const companyId = to.params.companyId as string | undefined
  if (companyId && companyId !== companyStore.activeCompanyId) {
    try {
      await companyStore.activateCompany(companyId)
    } catch {
      if (companyStore.companies.length > 0) {
        return '/select-company'
      }
      return '/setup'
    }
  }

  return true
})

app.mount('#app')
