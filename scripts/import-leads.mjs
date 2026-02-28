#!/usr/bin/env node
/**
 * import-leads.mjs
 * Usage: node scripts/import-leads.mjs [csvFile] [baseUrl]
 *
 * Defaults:
 *   csvFile : scripts/leads-example.csv
 *   baseUrl : http://localhost:3000
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const csvFile = process.argv[2] ?? 'scripts/leads-example.csv';
const baseUrl = (process.argv[3] ?? 'http://localhost:3000').replace(/\/$/, '');
const endpoint = `${baseUrl}/api/leads`;

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values;
}

async function importLeads() {
  const absPath = path.resolve(csvFile);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  const rl = readline.createInterface({ input: fs.createReadStream(absPath) });
  const lines = [];
  for await (const line of rl) {
    if (line.trim()) lines.push(line);
  }

  const [headerLine, ...dataLines] = lines;
  const headers = parseCSVLine(headerLine);

  console.log(`Importing ${dataLines.length} leads to ${endpoint}\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < dataLines.length; i++) {
    const values = parseCSVLine(dataLines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      const val = values[idx] ?? '';
      if (val !== '') row[h] = val;
    });

    const payload = {
      companyName: row.companyName,
      contactName: row.contactName,
      ...(row.contactEmail   && { contactEmail:   row.contactEmail }),
      ...(row.contactPhone   && { contactPhone:   row.contactPhone }),
      ...(row.productInterest && { productInterest: row.productInterest }),
      ...(row.companyWebsite  && { companyWebsite:  row.companyWebsite }),
    };

    if (!payload.companyName || !payload.contactName) {
      console.warn(`[${i + 1}] SKIP — missing companyName or contactName`);
      failed++;
      continue;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        console.log(`[${i + 1}] OK   — ${payload.companyName} / ${payload.contactName} (id: ${data.id ?? '?'})`);
        success++;
      } else {
        const err = await res.text();
        console.error(`[${i + 1}] FAIL — ${payload.companyName}: ${res.status} ${err}`);
        failed++;
      }
    } catch (err) {
      console.error(`[${i + 1}] ERR  — ${payload.companyName}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} imported, ${failed} failed.`);
}

importLeads();
