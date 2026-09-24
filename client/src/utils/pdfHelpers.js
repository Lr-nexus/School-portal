/* ------------------------------------------------------------------
   Shared PDF helpers — jsPDF + html2canvas (per-card rendering)
   ------------------------------------------------------------------ */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/* Shared html2canvas options for consistent output */
const H2C_OPTIONS = {
  scale: 2,
  useCORS: true,
  backgroundColor: '#ffffff',
  logging: false,
  letterRendering: true,
};

/* --------------------------------------------------------------
   Single element → PDF (used for on-screen report card & ID card)
   -------------------------------------------------------------- */
export async function downloadElementAsPdf(element, filename) {
  if (!element) throw new Error('Nothing to export');

  // Wait for webfonts so text isn't blurred
  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* ignore */ }
  }

  const safeName = (filename || 'document').replace(/[^\w.-]+/g, '-');

  // Small delay so layout settles
  await new Promise((r) => setTimeout(r, 100));

  const canvas = await html2canvas(element, H2C_OPTIONS);
  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  // Fit image into the page, preserving aspect ratio
  const imgAspect = canvas.height / canvas.width;
  let imgW = pdfW;
  let imgH = imgW * imgAspect;

  // If taller than a page, scale down
  if (imgH > pdfH) {
    imgH = pdfH;
    imgW = imgH / imgAspect;
  }

  // Center on the page
  const x = (pdfW - imgW) / 2;
  const y = (pdfH - imgH) / 2;

  pdf.addImage(imgData, 'JPEG', x, y, imgW, imgH, undefined, 'FAST');
  pdf.save(safeName);
}

/* --------------------------------------------------------------
   Batch → one PDF, one card per page.
   Renders each card SEPARATELY then merges — much more reliable
   than handing a big container to html2pdf.

   @param {string[]} pagesHtml  Array of HTML strings (one per card)
   @param {string}   filename
   @param {string}   cssText    CSS to inject while rendering
   -------------------------------------------------------------- */
export async function downloadBatchAsPdf(pagesHtml, filename, cssText = '') {
  if (!pagesHtml?.length) throw new Error('Nothing to export');

  // 1. Inject scoped CSS
  const styleEl = document.createElement('style');
  styleEl.id = '__h2p_style';
  styleEl.textContent = cssText;
  document.head.appendChild(styleEl);

  // 2. Off-screen container — but visible to html2canvas.
  //    html2canvas CAN capture off-screen elements as long as they're
  //    inside the DOM (display != none, visibility != hidden).
  const container = document.createElement('div');
  container.id = '__h2p_container';
  container.style.position = 'fixed';
  container.style.left = '-10000px';   // far off-screen but still laid out
  container.style.top = '0';
  container.style.width = '820px';
  container.style.background = '#ffffff';
  container.style.color = '#0b1220';
  container.style.zIndex = '-1';
  container.style.pointerEvents = 'none';
  container.style.fontFamily =
    "'Segoe UI', system-ui, -apple-system, sans-serif";
  container.innerHTML = pagesHtml.join('');
  document.body.appendChild(container);

  try {
    // Wait for fonts + one render tick
    if (document.fonts?.ready) {
      try { await document.fonts.ready; } catch { /* ignore */ }
    }
    await new Promise((r) => setTimeout(r, 300));

    // 3. Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    // 4. Render each card separately
    const cards = container.querySelectorAll('.report-card');
    if (!cards.length) throw new Error('No .report-card elements found');

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];

      const canvas = await html2canvas(card, H2C_OPTIONS);
      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      // Preserve aspect ratio, fit within A4
      const imgAspect = canvas.height / canvas.width;
      let imgW = pdfW;
      let imgH = imgW * imgAspect;
      if (imgH > pdfH) {
        imgH = pdfH;
        imgW = imgH / imgAspect;
      }

      // Center horizontally
      const x = (pdfW - imgW) / 2;

      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', x, 0, imgW, imgH, undefined, 'FAST');
    }

    // 5. Save
    const safeName = (filename || 'document').replace(/[^\w.-]+/g, '-');
    pdf.save(safeName);
  } finally {
    // 6. Cleanup
    if (container.parentNode) container.parentNode.removeChild(container);
    if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
  }
}