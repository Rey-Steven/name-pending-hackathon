# Elorus API Integration Plan

## Context
Integrate the Elorus invoicing/billing API into our Greek B2B sales automation platform so that:
- The **sales agent** can add companies, read products/stock, and create offers (with PDF)
- The **accounting agent** can create invoices (with PDF) and read payment status
- The **UI** lists contacts, products, offers, and invoices from Elorus with "View on Elorus" links

**Key decisions**: Elorus **replaces** local invoicing/PDF — no fallback. Each company has **its own Elorus credentials** (optional — can be added later). New views are **integrated into existing nav** (Sales / Accounting dropdowns). Features that need Elorus **require credentials** — without them, the UI shows a clear "configure Elorus" prompt and agent tasks that need Elorus are skipped with a message telling the user to set up credentials.

---

## 0. "Elorus not configured" Behavior — No Fallback

Features that need Elorus **require credentials**. No local fallback.

| Feature | Without Elorus | User-facing message |
|---------|---------------|---------------------|
| Contacts page | Empty state with setup link | "To manage contacts, add your Elorus API credentials in Company Setup." |
| Products page | Empty state with setup link | "To view products and stock, add your Elorus API credentials in Company Setup." |
| Offers page | Empty state with setup link | "To create and manage offers, add your Elorus API credentials in Company Setup." |
| Invoices page | Empty state with setup link | "To manage invoices, add your Elorus API credentials in Company Setup." |
| Offer approval (agent) | **Skipped** — offer not created | Agent logs: "Elorus not configured — cannot create offer." Task marked as skipped. |
| Invoice creation (agent) | **Skipped** — invoice not created | Agent logs: "Elorus not configured — cannot create invoice." Task marked as skipped. |

---

## 1. Database & Configuration

### 1a. Add Elorus fields to CompanyProfile

**File**: [db.ts](backend/src/database/db.ts)

Add to the `CompanyProfile` interface:
```ts
elorus_api_key?: string;
elorus_organization_id?: string;
```

### 1b. Update Company Setup

**File**: [CompanySetup.vue](frontend/src/views/CompanySetup.vue)

Add an "Elorus Integration" section with:
- API Key input (password type)
- Organization ID input
- "Test Connection" button that calls `GET /api/elorus/test-connection`

**File**: [company.routes.ts](backend/src/routes/company.routes.ts)

Ensure the setup/update endpoints persist the two new fields.

---

## 2. Backend: Elorus Service

### New file: `backend/src/services/elorus-service.ts`

A class that wraps all Elorus API calls. Instantiated per-request with the company's credentials.

```ts
class ElorusService {
  constructor(private apiKey: string, private organizationId: string) {}

  // Contacts
  listContacts(params?: { page?, search?, ctype? }): Promise<PaginatedResponse<ElorusContact>>
  createContact(data: CreateContactPayload): Promise<ElorusContact>
  getContact(id: string): Promise<ElorusContact>

  // Products
  listProducts(params?: { page?, search?, active? }): Promise<PaginatedResponse<ElorusProduct>>
  getProduct(id: string): Promise<ElorusProduct>   // includes stock

  // Estimates (Offers)
  listEstimates(params?: { page?, status?, client? }): Promise<PaginatedResponse<ElorusEstimate>>
  createEstimate(data: CreateEstimatePayload): Promise<ElorusEstimate>
  getEstimate(id: string): Promise<ElorusEstimate>
  getEstimatePDF(id: string): Promise<Buffer>
  updateEstimate(id: string, data: Partial<...>): Promise<ElorusEstimate>  // PATCH for draft/accept

  // Invoices
  listInvoices(params?: { page?, status?, client?, fpaid? }): Promise<PaginatedResponse<ElorusInvoice>>
  createInvoice(data: CreateInvoicePayload): Promise<ElorusInvoice>
  getInvoice(id: string): Promise<ElorusInvoice>   // includes status, paid, payable
  getInvoicePDF(id: string): Promise<Buffer>

  // Lookup helpers
  listTaxes(): Promise<ElorusTax[]>
  listDocumentTypes(application?: number): Promise<ElorusDocumentType[]>
}
```

Each method:
- Makes HTTP request to `https://api.elorus.com/v1.2/...`
- Sets headers: `Authorization: Token ${apiKey}`, `X-Elorus-Organization: ${orgId}`, `Content-Type: application/json`
- Uses `axios` (already a dependency)
- Throws descriptive errors on 4xx/5xx

### Helper: `getElorusService(companyId)`

A utility function used by routes and agents:
1. Fetches the company profile from Firestore
2. Checks `elorus_api_key` and `elorus_organization_id` exist
3. Returns `new ElorusService(key, orgId)` or **returns `null`** if credentials are not configured

Callers handle `null` gracefully:
- **Routes**: return `{ configured: false }` or 404 with message "Elorus not configured for this company"
- **Agents**: skip Elorus operations, log a warning, continue the workflow without creating Elorus documents
- **Frontend views**: show a friendly "Elorus not configured" card with a link to Company Setup

---

## 3. Backend: Elorus Routes

### New file: `backend/src/routes/elorus.routes.ts`

All endpoints use the company ID from `X-Company-Id` header to get per-company Elorus creds. Every endpoint first checks if Elorus is configured — if not, returns `{ configured: false, message: "Elorus not configured" }` with 200 status (not an error, so the frontend can show a helpful prompt).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/elorus/status` | Check if Elorus is configured for this company (returns `{ configured: boolean }`) |
| `GET` | `/api/elorus/test-connection` | Verify creds by calling `GET /v1.2/contacts/?page_size=1` |
| `GET` | `/api/elorus/contacts` | List contacts (query: page, search, ctype) |
| `POST` | `/api/elorus/contacts` | Create contact |
| `GET` | `/api/elorus/contacts/:id` | Get contact details |
| `GET` | `/api/elorus/products` | List products (query: page, search) |
| `GET` | `/api/elorus/products/:id` | Get product with stock |
| `GET` | `/api/elorus/estimates` | List estimates/offers (query: page, status, client) |
| `POST` | `/api/elorus/estimates` | Create estimate |
| `GET` | `/api/elorus/estimates/:id` | Get estimate details |
| `GET` | `/api/elorus/estimates/:id/pdf` | Download estimate PDF (proxy binary) |
| `PATCH` | `/api/elorus/estimates/:id` | Partial update (draft, accept_status) |
| `GET` | `/api/elorus/invoices` | List invoices (query: page, status, client) |
| `POST` | `/api/elorus/invoices` | Create invoice |
| `GET` | `/api/elorus/invoices/:id` | Get invoice (includes payment status) |
| `GET` | `/api/elorus/invoices/:id/pdf` | Download invoice PDF (proxy binary) |
| `GET` | `/api/elorus/taxes` | List available taxes |
| `GET` | `/api/elorus/document-types` | List document types |

### Mount in index.ts

**File**: [index.ts](backend/src/index.ts)
```ts
import elorusRoutes from './routes/elorus.routes';
app.use('/api/elorus', elorusRoutes);
```

---

## 4. Frontend: API Client

### File: [client.ts](frontend/src/api/client.ts)

Add `elorusApi` export:

```ts
export const elorusApi = {
  testConnection: () => api.get('/elorus/test-connection'),
  // Contacts
  listContacts: (params?) => api.get('/elorus/contacts', { params }),
  createContact: (data) => api.post('/elorus/contacts', data),
  getContact: (id) => api.get(`/elorus/contacts/${id}`),
  // Products
  listProducts: (params?) => api.get('/elorus/products', { params }),
  getProduct: (id) => api.get(`/elorus/products/${id}`),
  // Estimates
  listEstimates: (params?) => api.get('/elorus/estimates', { params }),
  createEstimate: (data) => api.post('/elorus/estimates', data),
  getEstimate: (id) => api.get(`/elorus/estimates/${id}`),
  getEstimatePDF: (id) => api.get(`/elorus/estimates/${id}/pdf`, { responseType: 'blob' }),
  updateEstimate: (id, data) => api.patch(`/elorus/estimates/${id}`, data),
  // Invoices
  listInvoices: (params?) => api.get('/elorus/invoices', { params }),
  createInvoice: (data) => api.post('/elorus/invoices', data),
  getInvoice: (id) => api.get(`/elorus/invoices/${id}`),
  getInvoicePDF: (id) => api.get(`/elorus/invoices/${id}/pdf`, { responseType: 'blob' }),
  // Lookup
  listTaxes: () => api.get('/elorus/taxes'),
  listDocumentTypes: () => api.get('/elorus/document-types'),
}
```

---

## 5. Frontend: New Views

**All Elorus views** first call `GET /api/elorus/status`. If `configured: false`, they show a friendly empty state: "Elorus is not configured for this company. Go to Company Setup to add your Elorus API key and Organization ID." with a button linking to `/setup`. No errors, no broken UI.

### 5a. Elorus Contacts List

**New file**: `frontend/src/views/ElorusContactsList.vue`

- Table with columns: Company, Contact Name, Tax ID, Email, Phone
- Search bar (uses Elorus API search param)
- Pagination (Elorus returns `count`, `next`, `previous`)
- "Add Contact" button → modal with form (company, first_name, last_name, vat_number, email, phone, address)
- Each row has "View on Elorus" link → opens `https://app.elorus.com/{orgId}/contacts/{contactId}/` in new tab

### 5b. Elorus Products List

**New file**: `frontend/src/views/ElorusProductsList.vue`

- Table with columns: Code, Title, Description, Unit Price, Stock, Unit, Status
- Search bar
- Pagination
- Stock shown as badge (green if >0, red if 0)
- Read-only (no create/edit - products managed in Elorus)

### 5c. Elorus Offers List

**New file**: `frontend/src/views/ElorusOffersList.vue`

- Table with columns: Number, Client, Date, Total, Status, Actions
- Status filter dropdown (draft, issued, accepted, rejected)
- Search + pagination
- Actions per row:
  - "Download PDF" → calls getEstimatePDF, triggers browser download
  - "View on Elorus" → opens `permalink` from API response in new tab
- "Create Offer" button → modal/form (select contact, add line items from products, set quantities)

### 5d. Updated Invoices List

**File**: [InvoicesList.vue](frontend/src/views/InvoicesList.vue) — **rewrite** to use Elorus API

- Table with columns: Number, Client, Date, Due Date, Total, Paid, Status, Actions
- Status filter (draft, issued, partial, paid, overdue, void)
- Search + pagination
- Payment progress: show `paid` / `payable` amounts
- Actions per row:
  - "Download PDF" → calls getInvoicePDF
  - "View on Elorus" → opens `permalink` in new tab
- Summary cards: Total invoiced, Total paid, Total outstanding

---

## 6. Frontend: Navigation & Router

### File: [App.vue](frontend/src/App.vue)

Update `navItems`:
```ts
{ label: 'Sales', children: [
  { label: 'Leads', subpath: 'leads' },
  { label: 'Deals', subpath: 'deals' },
  { label: 'Contacts', subpath: 'elorus-contacts' },    // NEW
  { label: 'Products', subpath: 'elorus-products' },     // NEW
  { label: 'Offers', subpath: 'elorus-offers' },         // NEW
]},
{ label: 'Accounting', children: [
  { label: 'Invoices', subpath: 'invoices' },            // now uses Elorus
]},
```

### File: [main.ts](frontend/src/main.ts)

Add new routes:
```ts
{ path: 'elorus-contacts', name: 'elorus-contacts', component: ElorusContactsList },
{ path: 'elorus-products', name: 'elorus-products', component: ElorusProductsList },
{ path: 'elorus-offers', name: 'elorus-offers', component: ElorusOffersList },
```

---

## 7. Agent Integration

### 7a. Sales Agent → Create Elorus Estimate on Offer Approval

**File**: [deals.routes.ts](backend/src/routes/deals.routes.ts) — `POST /:id/approve-offer`

After the current approval logic, create Elorus estimate (required — no fallback):
1. Call `getElorusService(companyId)` — if `null`, **fail the operation** with error "Elorus not configured — cannot create offer. Please add Elorus credentials in Company Setup."
2. If Elorus IS configured:
   - Get/create Elorus contact for the lead (look up by `vat_number` or `custom_id`, create if missing)
   - Find the 24% FPA tax ID via `listTaxes()` (cache per-company)
   - Create Elorus estimate via `createEstimate()` with the offer line items
   - Issue the estimate: `PATCH /estimates/{id}` with `{ "draft": false }`
   - Download PDF via `getEstimatePDF()`
   - Email the PDF to the customer (existing EmailAgent flow)
   - Store the Elorus estimate ID on the deal record (`elorus_estimate_id` field on Deal)

### 7b. Accounting Agent → Create Elorus Invoice

**File**: [accounting-agent.ts](backend/src/agents/accounting-agent.ts)

Modify `generateInvoice()`:
1. AI still generates the invoice structure (line items, amounts)
2. Call `getElorusService(companyId)` — if `null`, **skip entirely**, log "Elorus not configured — invoice creation skipped", mark task as skipped, return early
3. If Elorus IS configured:
   - Get/create Elorus contact for the lead
   - Find tax IDs
   - Create Elorus invoice via `createInvoice()`
   - Store the Elorus invoice ID on the deal record (`elorus_invoice_id` field on Deal)
4. PDF comes from Elorus when needed (not generated locally)
5. Remove local `InvoiceDB.create()` — Elorus is the only invoice store

### 7c. Lead → Elorus Contact Mapping

**File**: [db.ts](backend/src/database/db.ts)

Add `elorus_contact_id?: string` field to the `Lead` interface.

**Utility function** in `elorus-service.ts`:
```ts
async function getOrCreateElorusContact(elorusService: ElorusService, lead: Lead): Promise<string> {
  // If lead already has elorus_contact_id, return it
  if (lead.elorus_contact_id) return lead.elorus_contact_id;

  // Try to find by vat_number
  if (lead.vat_id) {
    const results = await elorusService.listContacts({ search: lead.vat_id });
    if (results.results.length > 0) {
      const contactId = results.results[0].id;
      await LeadDB.update(lead.id!, { elorus_contact_id: contactId });
      return contactId;
    }
  }

  // Create new contact
  const contact = await elorusService.createContact({
    company: lead.company_name,
    first_name: lead.contact_name?.split(' ')[0] || '',
    last_name: lead.contact_name?.split(' ').slice(1).join(' ') || '',
    vat_number: lead.vat_id || '',
    is_client: true,
    email: lead.contact_email ? [{ email: lead.contact_email, primary: true }] : [],
    phones: lead.contact_phone ? [{ number: lead.contact_phone, primary: true }] : [],
    addresses: lead.address ? [{
      address_line: lead.address,
      city: lead.city || '',
      zip: lead.postal_code || '',
      country: 'GR'
    }] : [],
  });

  await LeadDB.update(lead.id!, { elorus_contact_id: contact.id });
  return contact.id;
}
```

---

## 8. Deal Schema Updates

**File**: [db.ts](backend/src/database/db.ts)

Add to `Deal` interface:
```ts
elorus_estimate_id?: string;
elorus_invoice_id?: string;
```

These store the Elorus resource IDs so we can link back to them.

---

## 9. Files to Create

| File | Purpose |
|------|---------|
| `backend/src/services/elorus-service.ts` | Elorus API client class |
| `backend/src/routes/elorus.routes.ts` | Backend API proxy routes |
| `frontend/src/views/ElorusContactsList.vue` | Contacts list view |
| `frontend/src/views/ElorusProductsList.vue` | Products + stock view |
| `frontend/src/views/ElorusOffersList.vue` | Estimates/offers view |

## 10. Files to Modify

| File | Changes |
|------|---------|
| `backend/src/database/db.ts` | Add elorus fields to CompanyProfile, Lead, Deal interfaces |
| `backend/src/index.ts` | Mount elorus routes |
| `backend/src/routes/deals.routes.ts` | Approve-offer creates Elorus estimate + gets PDF |
| `backend/src/agents/accounting-agent.ts` | Create Elorus invoice instead of local |
| `frontend/src/api/client.ts` | Add `elorusApi` methods |
| `frontend/src/main.ts` | Add 3 new routes |
| `frontend/src/App.vue` | Add nav items for Contacts, Products, Offers |
| `frontend/src/views/InvoicesList.vue` | Rewrite to use Elorus invoices API |
| `frontend/src/views/CompanySetup.vue` | Add Elorus API Key + Org ID fields |
| `backend/src/routes/company.routes.ts` | Persist Elorus credentials on setup/update |

## 11. Cleanup / Removals

- Remove `generateOfferPDF` usage from deals.routes.ts (PDF now comes from Elorus)
- Remove local `InvoiceDB.create()` from accounting-agent.ts (invoices live in Elorus only)
- The `invoices` Firestore collection is no longer written to (can keep schema for reference)
- Keep `pdf-generator.ts` file but it's no longer used for offers/invoices
- InvoicesList.vue is fully rewritten to use Elorus API

---

## 12. Implementation Order

1. **DB schema changes** — add Elorus fields to interfaces (CompanyProfile, Lead, Deal)
2. **Elorus service** — `elorus-service.ts` with all API methods
3. **Elorus routes** — `elorus.routes.ts` + mount in index.ts
4. **Company setup** — add Elorus credential fields + test connection
5. **Frontend API client** — add `elorusApi` to client.ts
6. **Frontend views** — ElorusContactsList, ElorusProductsList, ElorusOffersList
7. **Rewrite InvoicesList** — switch to Elorus invoices
8. **Navigation + router** — add new routes and nav items
9. **Agent integration** — modify deals.routes.ts approve-offer + accounting-agent.ts
10. **Testing** — verify end-to-end flow with Elorus demo org

---

## 13. Verification Plan

1. **Test connection**: Company setup → enter Elorus creds → "Test Connection" returns success
2. **Contacts**: Navigate to Contacts → see Elorus contacts list → create a contact → verify it appears in Elorus UI
3. **Products**: Navigate to Products → see products with stock levels from Elorus
4. **Offers**: Create a lead → run workflow → approve offer → verify Elorus estimate created → download PDF → "View on Elorus" opens correct page
5. **Invoices**: After deal closes → accounting agent creates Elorus invoice → shows in Invoices list with payment status → download PDF works → "View on Elorus" opens correct page
6. **Payment status**: Mark invoice as paid in Elorus UI → refresh Invoices list → status changes to "paid"
