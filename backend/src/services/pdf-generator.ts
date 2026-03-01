import PDFDocument from 'pdfkit';
import { Deal, Lead, CompanyProfile } from '../database/db';

const COLORS = {
  primary: '#3b82f6',
  heading: '#1e3a5f',
  body: '#333333',
  secondary: '#666666',
  tableHeaderBg: '#f3f4f6',
  tableBorder: '#e5e7eb',
  white: '#ffffff',
};

const MARGIN = 50;

function formatEUR(amount: number): string {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('el-GR');
}

function validityDate(fromDate: Date, days: number): string {
  const d = new Date(fromDate);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

export async function generateOfferPDF(params: {
  deal: Deal;
  lead: Lead;
  companyProfile: CompanyProfile;
}): Promise<Buffer> {
  const { deal, lead, companyProfile } = params;
  const now = new Date();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - MARGIN * 2;

    // ─── Top accent bar ───
    doc.rect(0, 0, pageWidth, 4).fill(COLORS.primary);

    // ─── Header section ───
    let y = 30;

    // Company name (left)
    doc.fontSize(22).fillColor(COLORS.heading).text(companyProfile.name || 'AgentFlow', MARGIN, y);
    y += 28;

    if (companyProfile.industry) {
      doc.fontSize(9).fillColor(COLORS.secondary).text(companyProfile.industry, MARGIN, y);
      y += 14;
    }
    if (companyProfile.website) {
      doc.fontSize(9).fillColor(COLORS.secondary).text(companyProfile.website, MARGIN, y);
    }

    // Document title + meta (right)
    const rightX = pageWidth - MARGIN - 180;
    doc.fontSize(18).fillColor(COLORS.heading).text('PROSFORÁ', rightX, 30, { width: 180, align: 'right' });
    doc.fontSize(9).fillColor(COLORS.secondary);
    doc.text(`Offer`, rightX, 52, { width: 180, align: 'right' });

    const refId = (deal.id || '').slice(0, 8).toUpperCase();
    doc.fontSize(9).fillColor(COLORS.body);
    doc.text(`Date: ${formatDate(now)}`, rightX, 72, { width: 180, align: 'right' });
    doc.text(`Ref: OFFER-${refId}`, rightX, 86, { width: 180, align: 'right' });
    doc.text(`Valid until: ${validityDate(now, 30)}`, rightX, 100, { width: 180, align: 'right' });

    // Separator
    y = 120;
    doc.moveTo(MARGIN, y).lineTo(pageWidth - MARGIN, y).strokeColor(COLORS.tableBorder).lineWidth(1).stroke();

    // ─── Customer details section ───
    y += 16;
    doc.fontSize(11).fillColor(COLORS.heading).text('STOICHEIA PELATI', MARGIN, y);
    doc.fontSize(9).fillColor(COLORS.secondary).text('Customer Details', MARGIN + 145, y + 1);
    y += 22;

    const col1X = MARGIN;
    const col2X = MARGIN + contentWidth / 2;

    doc.fontSize(10).fillColor(COLORS.body);
    doc.text(`Company: ${lead.company_name || '-'}`, col1X, y);
    doc.text(`Contact: ${lead.contact_name || '-'}`, col2X, y);
    y += 16;
    doc.text(`Email: ${lead.contact_email || '-'}`, col1X, y);
    doc.text(`Phone: ${lead.contact_phone || '-'}`, col2X, y);
    y += 16;
    if (lead.industry) {
      doc.text(`Industry: ${lead.industry}`, col1X, y);
      y += 16;
    }

    // Separator
    y += 8;
    doc.moveTo(MARGIN, y).lineTo(pageWidth - MARGIN, y).strokeColor(COLORS.tableBorder).lineWidth(1).stroke();

    // ─── Offer breakdown table ───
    y += 16;
    doc.fontSize(11).fillColor(COLORS.heading).text('ANALYTIKI PROSFORA', MARGIN, y);
    doc.fontSize(9).fillColor(COLORS.secondary).text('Offer Breakdown', MARGIN + 160, y + 1);
    y += 24;

    // Table header
    const colWidths = [contentWidth * 0.4, contentWidth * 0.15, contentWidth * 0.2, contentWidth * 0.25];
    const colX = [MARGIN, MARGIN + colWidths[0], MARGIN + colWidths[0] + colWidths[1], MARGIN + colWidths[0] + colWidths[1] + colWidths[2]];
    const rowHeight = 28;

    // Header background
    doc.rect(MARGIN, y, contentWidth, rowHeight).fill(COLORS.tableHeaderBg);
    doc.fontSize(9).fillColor(COLORS.heading);
    doc.text('Product', colX[0] + 8, y + 8);
    doc.text('Qty', colX[1] + 8, y + 8);
    doc.text('Unit Price', colX[2] + 8, y + 8);
    doc.text('Total', colX[3] + 8, y + 8);
    y += rowHeight;

    // Table border top
    doc.moveTo(MARGIN, y).lineTo(pageWidth - MARGIN, y).strokeColor(COLORS.tableBorder).lineWidth(0.5).stroke();

    // Data row
    const unitPrice = deal.quantity && deal.quantity > 0 ? deal.subtotal / deal.quantity : deal.subtotal;
    doc.fontSize(10).fillColor(COLORS.body);
    doc.text(deal.product_name || '-', colX[0] + 8, y + 8, { width: colWidths[0] - 16 });
    doc.text(String(deal.quantity || 1), colX[1] + 8, y + 8);
    doc.text(formatEUR(unitPrice), colX[2] + 8, y + 8);
    doc.text(formatEUR(deal.subtotal), colX[3] + 8, y + 8);
    y += rowHeight;

    // Table border bottom
    doc.moveTo(MARGIN, y).lineTo(pageWidth - MARGIN, y).strokeColor(COLORS.tableBorder).lineWidth(0.5).stroke();

    // ─── Totals section ───
    y += 16;
    const totalsX = pageWidth - MARGIN - 220;
    const totalsValX = pageWidth - MARGIN - 10;

    doc.fontSize(10).fillColor(COLORS.body);
    doc.text('Subtotal:', totalsX, y);
    doc.text(formatEUR(deal.subtotal), totalsValX - 100, y, { width: 100, align: 'right' });
    y += 18;

    const fpaRate = deal.fpa_rate || 0.24;
    doc.text(`FPA (${(fpaRate * 100).toFixed(0)}%):`, totalsX, y);
    doc.text(formatEUR(deal.fpa_amount), totalsValX - 100, y, { width: 100, align: 'right' });
    y += 18;

    // Total divider
    doc.moveTo(totalsX, y).lineTo(pageWidth - MARGIN, y).strokeColor(COLORS.heading).lineWidth(1).stroke();
    y += 8;

    doc.fontSize(13).fillColor(COLORS.heading);
    doc.text('TOTAL:', totalsX, y);
    doc.text(formatEUR(deal.total_amount), totalsValX - 120, y, { width: 120, align: 'right' });

    // ─── Payment terms section ───
    y += 40;
    doc.moveTo(MARGIN, y).lineTo(pageWidth - MARGIN, y).strokeColor(COLORS.tableBorder).lineWidth(1).stroke();
    y += 16;

    doc.fontSize(11).fillColor(COLORS.heading).text('OROI PLIRWMIS', MARGIN, y);
    doc.fontSize(9).fillColor(COLORS.secondary).text('Payment Terms', MARGIN + 120, y + 1);
    y += 22;

    doc.fontSize(10).fillColor(COLORS.body);
    const terms = [
      'Payment within 30 days / Pliromi entos 30 imeron',
      'Bank transfer / Trapeziki metafora',
      `Offer valid for 30 days (until ${validityDate(now, 30)})`,
    ];
    for (const term of terms) {
      doc.text(`  -  ${term}`, MARGIN, y);
      y += 16;
    }

    // ─── Notes section (if sales_notes exists) ───
    if (deal.sales_notes) {
      y += 12;
      doc.moveTo(MARGIN, y).lineTo(pageWidth - MARGIN, y).strokeColor(COLORS.tableBorder).lineWidth(1).stroke();
      y += 16;
      doc.fontSize(11).fillColor(COLORS.heading).text('SIMEIOSIS', MARGIN, y);
      doc.fontSize(9).fillColor(COLORS.secondary).text('Notes', MARGIN + 85, y + 1);
      y += 22;
      doc.fontSize(10).fillColor(COLORS.body).text(deal.sales_notes, MARGIN, y, { width: contentWidth });
    }

    // ─── Footer ───
    const footerY = doc.page.height - 60;
    doc.moveTo(MARGIN, footerY).lineTo(pageWidth - MARGIN, footerY).strokeColor(COLORS.tableBorder).lineWidth(0.5).stroke();
    doc.fontSize(8).fillColor(COLORS.secondary);
    doc.text('This offer was automatically generated by AgentFlow AI.', MARGIN, footerY + 10, { width: contentWidth, align: 'center' });

    // Bottom accent bar
    doc.rect(0, doc.page.height - 4, pageWidth, 4).fill(COLORS.primary);

    doc.end();
  });
}

export async function generateContractPDF(params: {
  deal: Deal;
  lead: Lead;
  companyProfile: CompanyProfile;
  contractText: string;
}): Promise<Buffer> {
  const { deal, lead, companyProfile, contractText } = params;
  const now = new Date();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - MARGIN * 2;

    // ─── Top accent bar ───
    doc.rect(0, 0, pageWidth, 4).fill(COLORS.primary);

    // ─── Header ───
    let y = 30;
    doc.fontSize(20).fillColor(COLORS.heading).text(companyProfile.name || 'Company', MARGIN, y);
    y += 26;
    if (companyProfile.industry) {
      doc.fontSize(9).fillColor(COLORS.secondary).text(companyProfile.industry, MARGIN, y);
      y += 14;
    }
    if (companyProfile.website) {
      doc.fontSize(9).fillColor(COLORS.secondary).text(companyProfile.website, MARGIN, y);
    }

    const rightX = pageWidth - MARGIN - 200;
    doc.fontSize(16).fillColor(COLORS.heading).text('SERVICE AGREEMENT', rightX, 30, { width: 200, align: 'right' });
    const refId = (deal.id || '').slice(0, 8).toUpperCase();
    doc.fontSize(9).fillColor(COLORS.secondary);
    doc.text(`Ref: CONTRACT-${refId}`, rightX, 54, { width: 200, align: 'right' });
    doc.text(`Date: ${formatDate(now)}`, rightX, 68, { width: 200, align: 'right' });

    y = 110;
    doc.moveTo(MARGIN, y).lineTo(pageWidth - MARGIN, y).strokeColor(COLORS.tableBorder).lineWidth(1).stroke();

    // ─── Parties ───
    y += 16;
    doc.fontSize(11).fillColor(COLORS.heading).text('PARTIES TO THE AGREEMENT', MARGIN, y);
    y += 22;
    doc.fontSize(10).fillColor(COLORS.body);
    doc.text(`Provider: ${companyProfile.name}`, MARGIN, y);
    y += 16;
    doc.text(`Client: ${lead.company_name}  |  Contact: ${lead.contact_name}`, MARGIN, y);
    y += 16;
    if (lead.vat_id) { doc.text(`ΑΦΜ: ${lead.vat_id}`, MARGIN, y); y += 16; }
    if (lead.gemi_number) { doc.text(`ΓΕΜΗ: ${lead.gemi_number}`, MARGIN, y); y += 16; }
    if (lead.address) {
      const addr = [lead.address, lead.city, lead.postal_code].filter(Boolean).join(', ');
      doc.text(`Address: ${addr}`, MARGIN, y);
      y += 16;
    }

    // ─── Deal summary ───
    y += 8;
    doc.moveTo(MARGIN, y).lineTo(pageWidth - MARGIN, y).strokeColor(COLORS.tableBorder).lineWidth(0.5).stroke();
    y += 16;
    doc.fontSize(11).fillColor(COLORS.heading).text('DEAL SUMMARY', MARGIN, y);
    y += 22;
    doc.fontSize(10).fillColor(COLORS.body);
    const totalStr = `€${(deal.total_amount || 0).toFixed(2)} (incl. FPA 24%)`;
    doc.text(`Product/Service: ${deal.product_name}  |  Qty: ${deal.quantity || 1}  |  Total: ${totalStr}`, MARGIN, y);
    y += 24;

    // ─── Contract text ───
    doc.moveTo(MARGIN, y).lineTo(pageWidth - MARGIN, y).strokeColor(COLORS.tableBorder).lineWidth(0.5).stroke();
    y += 16;
    doc.fontSize(11).fillColor(COLORS.heading).text('TERMS AND CONDITIONS', MARGIN, y);
    y += 22;

    // Substitute placeholders
    const filled = contractText
      .replace(/\[CLIENT_NAME\]/g, lead.company_name)
      .replace(/\[CLIENT_AFM\]/g, lead.vat_id || 'N/A')
      .replace(/\[DATE\]/g, formatDate(now))
      .replace(/\[PRODUCT\]/g, deal.product_name)
      .replace(/\[AMOUNT\]/g, totalStr);

    doc.fontSize(9.5).fillColor(COLORS.body).text(filled, MARGIN, y, {
      width: contentWidth,
      lineGap: 3,
    });

    // ─── Signatures (new page) ───
    doc.addPage();
    doc.rect(0, 0, pageWidth, 4).fill(COLORS.primary);
    y = 60;
    doc.fontSize(12).fillColor(COLORS.heading).text('SIGNATURES', MARGIN, y);
    y += 30;

    const sigColWidth = (contentWidth - 40) / 2;
    const sig2X = MARGIN + sigColWidth + 40;

    doc.fontSize(10).fillColor(COLORS.body);
    doc.text(`For ${companyProfile.name}:`, MARGIN, y);
    doc.text(`For ${lead.company_name}:`, sig2X, y);
    y += 50;
    doc.moveTo(MARGIN, y).lineTo(MARGIN + sigColWidth, y).strokeColor(COLORS.heading).lineWidth(0.5).stroke();
    doc.moveTo(sig2X, y).lineTo(sig2X + sigColWidth, y).strokeColor(COLORS.heading).lineWidth(0.5).stroke();
    y += 12;
    doc.fontSize(9).fillColor(COLORS.secondary);
    doc.text('Authorised signatory / Date', MARGIN, y);
    doc.text('Authorised signatory / Date', sig2X, y);

    doc.rect(0, doc.page.height - 4, pageWidth, 4).fill(COLORS.primary);
    doc.end();
  });
}
