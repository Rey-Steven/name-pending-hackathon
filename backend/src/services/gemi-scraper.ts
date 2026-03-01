import { GemiCompanyDB, GemiScraperStateDB, GemiCompany, GemiScraperState } from '../database/db';

// ─── Constants ──────────────────────────────────────────────────

const GEMI_API_URL = 'https://publicity.businessportal.gr/api/company/details';
const RATE_LIMIT_MS = 1000;
const MAX_CONSECUTIVE_MISSES = 300;
const FETCH_TIMEOUT_MS = 15000;

// Chambers ordered by frequency (most common first)
const CHAMBERS = [
  3, 1, 6, 16, 8, 9, 27, 7, 4, 38, 36, 54, 40, 44, 22, 12, 2, 26, 5, 20,
  31, 52, 17, 45, 14, 55, 58, 50, 13, 34, 57, 53, 29, 46, 41, 37, 39, 42,
  30, 24, 48, 19, 15, 28, 21, 59, 43, 32, 25, 33, 49, 51, 18, 11, 47, 35,
  10, 60, 56, 23,
];

// ─── Re-entrance guard ─────────────────────────────────────────

let scrapingGemi = false;
let abortController: AbortController | null = null;

// ─── Helpers ────────────────────────────────────────────────────

function buildGemiNumber(companyId: number, chamberId: number, branch: string = '000'): string {
  const companyPart = String(companyId).padStart(7, '0');
  const chamberPart = String(chamberId).padStart(2, '0');
  return `${companyPart}${chamberPart}${branch}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── GEMI API call ──────────────────────────────────────────────

interface GemiApiResult {
  success: boolean;
  data: any;
}

async function fetchGemiCompany(gemiNumber: string): Promise<GemiApiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(GEMI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: { arGEMI: gemiNumber },
        token: null,
        language: 'el',
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      return { success: false, data: null };
    }

    const json: any = await response.json();

    // API returns { message: "Company not found" } for non-existent companies
    // and { companyInfo: { payload: { company: {...} } } } for existing ones
    if (!json?.companyInfo?.payload?.company) {
      return { success: false, data: null };
    }

    return { success: true, data: json };
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      console.warn(`  GEMI API timeout for ${gemiNumber}`);
    }
    return { success: false, data: null };
  }
}

// ─── Response parser ────────────────────────────────────────────

function parseGemiResponse(
  raw: any,
  gemiNumber: string,
  companyId: number,
  chamberId: number,
): Omit<GemiCompany, 'id'> {
  const payload = raw.companyInfo.payload;
  const company = payload.company;
  const moreInfo = payload.moreInfo || {};
  const chamberInfo = payload.chamberInfo || {};
  const kadData: any[] = payload.kadData || [];

  // Parse KAD codes
  let kadPrimary: string | undefined = undefined;
  let kadSecondary: string | undefined = undefined;

  const primaryKad = kadData.find((k: any) => k.activities === 'Κύρια');
  const secondaryKads = kadData.filter((k: any) => k.activities !== 'Κύρια');

  if (primaryKad) {
    kadPrimary = JSON.stringify({ code: primaryKad.kad, description: primaryKad.descr });
  }
  if (secondaryKads.length > 0) {
    kadSecondary = JSON.stringify(
      secondaryKads.map((k: any) => ({ code: k.kad, description: k.descr })),
    );
  }

  // Build address
  const street = company.company_street?.trim() || '';
  const number = company.company_street_number?.trim() || '';
  const city = company.company_city?.trim() || '';
  const zip = company.company_zip_code?.trim() || '';
  const address = [street, number, city, zip].filter(Boolean).join(', ');

  return {
    gemi_number: gemiNumber,
    company_id_num: companyId,
    chamber_id: chamberId,
    branch_code: '000',
    name: company.name || '',
    title: company.titles?.[0]?.title || undefined,
    afm: company.afm || undefined,
    chamber_name: chamberInfo.chamberName || undefined,
    status: company.companyStatus?.status || undefined,
    foundation_date: company.dateStart || undefined,
    phone: moreInfo.telephone || undefined,
    email: moreInfo.email || undefined,
    address: address || undefined,
    legal_form: company.legalType?.desc || undefined,
    kad_primary: kadPrimary,
    kad_secondary: kadSecondary,
    raw_response: JSON.stringify(raw),
  };
}

// ─── Main scraper loop ──────────────────────────────────────────

async function runScraperLoop(): Promise<void> {
  const state = await GemiScraperStateDB.get();

  let currentCompanyId = state.last_company_id + 1;

  // Cross-check with DB in case state doc is stale
  const highestInDb = await GemiCompanyDB.getHighestCompanyId();
  if (highestInDb && highestInDb >= currentCompanyId) {
    currentCompanyId = highestInDb + 1;
  }

  console.log(`\n🏛️  GEMI scraper: starting from company_id ${currentCompanyId}`);

  await GemiScraperStateDB.update({
    status: 'running',
    last_run_started_at: new Date().toISOString(),
    companies_found_this_run: 0,
    consecutive_misses: 0,
  });

  let consecutiveMisses = 0;
  let foundThisRun = 0;
  const baseTotal = state.total_companies_found || 0;

  while (consecutiveMisses < MAX_CONSECUTIVE_MISSES) {
    if (abortController?.signal.aborted) {
      console.log('  GEMI scraper: received stop signal');
      break;
    }

    let foundForThisCompany = false;

    for (const chamberId of CHAMBERS) {
      if (abortController?.signal.aborted) break;

      const gemiNumber = buildGemiNumber(currentCompanyId, chamberId);
      const result = await fetchGemiCompany(gemiNumber);

      if (result.success && result.data) {
        const companyData = parseGemiResponse(result.data, gemiNumber, currentCompanyId, chamberId);

        // Dedup check
        const existing = await GemiCompanyDB.findByGemiNumber(gemiNumber);
        if (!existing) {
          await GemiCompanyDB.create(companyData as GemiCompany);
          foundThisRun++;
          console.log(`  ✅ GEMI ${gemiNumber}: ${companyData.name} (chamber: ${chamberId})`);
        }

        foundForThisCompany = true;

        // Save state every 5 companies found instead of after each one
        if (foundThisRun % 5 === 0) {
          await GemiScraperStateDB.update({
            last_company_id: currentCompanyId,
            companies_found_this_run: foundThisRun,
            total_companies_found: baseTotal + foundThisRun,
            consecutive_misses: 0,
            current_company_id: currentCompanyId,
          });
        }

        break; // Found the chamber for this company_id, move on
      }

      await sleep(RATE_LIMIT_MS);
    }

    if (foundForThisCompany) {
      consecutiveMisses = 0;
    } else {
      consecutiveMisses++;
      // Persist progress every 10 misses
      if (consecutiveMisses % 10 === 0) {
        await GemiScraperStateDB.update({
          last_company_id: currentCompanyId,
          consecutive_misses: consecutiveMisses,
          current_company_id: currentCompanyId,
        });
      }
    }

    currentCompanyId++;

    if (!foundForThisCompany) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  const finalStatus = abortController?.signal.aborted ? 'stopped' : 'idle';
  await GemiScraperStateDB.update({
    status: finalStatus,
    last_company_id: currentCompanyId - 1,
    last_run_completed_at: new Date().toISOString(),
    companies_found_this_run: foundThisRun,
    total_companies_found: baseTotal + foundThisRun,
  });

  console.log(`\n🏛️  GEMI scraper: finished. Found ${foundThisRun} companies. Stopped after ${consecutiveMisses} consecutive misses.`);
}

// ─── Poller entry point (called by setInterval) ────────────────

export async function pollGemiScraper(): Promise<void> {
  if (scrapingGemi) return;
  scrapingGemi = true;

  try {
    const state = await GemiScraperStateDB.get();

    // Skip if already ran within last 22 hours
    if (state.last_run_completed_at) {
      const hoursAgo = (Date.now() - new Date(state.last_run_completed_at).getTime()) / (1000 * 60 * 60);
      if (hoursAgo < 22) {
        scrapingGemi = false;
        return;
      }
    }

    // Crash recovery: reset stale "running" status
    if (state.status === 'running') {
      console.log('  GEMI scraper: previous run still marked as running — resetting to idle');
      await GemiScraperStateDB.update({ status: 'idle' });
    }

    abortController = new AbortController();
    await runScraperLoop();
  } catch (err: any) {
    console.error('pollGemiScraper error:', err.message);
    await GemiScraperStateDB.update({
      status: 'idle',
      last_error: err.message,
    });
  } finally {
    scrapingGemi = false;
    abortController = null;
  }
}

// ─── Manual trigger ─────────────────────────────────────────────

export async function triggerGemiScraper(): Promise<{ started: boolean; message: string }> {
  if (scrapingGemi) {
    return { started: false, message: 'Scraper is already running' };
  }

  // Launch in background (don't await)
  pollGemiScraper();

  return { started: true, message: 'GEMI scraper started' };
}

// ─── Stop ───────────────────────────────────────────────────────

export async function stopGemiScraper(): Promise<{ stopped: boolean; message: string }> {
  if (!scrapingGemi || !abortController) {
    return { stopped: false, message: 'Scraper is not running' };
  }

  abortController.abort();
  return { stopped: true, message: 'Stop signal sent. Scraper will finish current request and stop.' };
}

// ─── Status ─────────────────────────────────────────────────────

export async function getGemiScraperStatus(): Promise<GemiScraperState & { is_running: boolean }> {
  const state = await GemiScraperStateDB.get();
  return { ...state, is_running: scrapingGemi };
}
