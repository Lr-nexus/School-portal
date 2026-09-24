/* ------------------------------------------------------------------
   Shared PDF helpers — html2pdf.js wrapper
   ------------------------------------------------------------------ */

const A4_PORTRAIT = {
  margin: [6, 8, 6, 8],
  image: { type: 'jpeg', quality: 0.98 },
  html2canvas: {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    letterRendering: true,
    scrollX: 0,
    scrollY: 0,
    windowWidth: 900,
    logging: false,
  },
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
};

/**
 * Convert a DOM element to a PDF and trigger a download.
 * The element MUST be visible in the DOM (not display:none, not off-screen).
 */
export async function downloadElementAsPdf(element, filename, extra = {}) {
  if (!element) throw new Error('Nothing to export');

  // Wait for webfonts so text isn't blurred
  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* ignore */ }
  }

  const html2pdf = (await import('html2pdf.js')).default;
  const safeName = (filename || 'document').replace(/[^\w.-]+/g, '-');

  await html2pdf()
    .set({ ...A4_PORTRAIT, ...extra, filename: safeName })
    .from(element)
    .save();
}

/**
 * Batch PDF — one HTML page per report card.
 *
 * IMPORTANT: html2canvas cannot capture off-screen elements.
 * We therefore place the container ON-SCREEN at the top-left, but
 * behind the currently-open modal (z-index 100), so the user never
 * sees it while it renders.
 *
 * @param {string[]} pagesHtml   Array of HTML strings, each is one PDF page
 * @param {string}   filename
 * @param {string}   cssText     CSS injected while rendering
 */
export async function downloadBatchAsPdf(pagesHtml, filename, cssText = '') {
  // 1. Inject the scoped CSS so the cards get their layout
  const styleEl = document.createElement('style');
  styleEl.id = '__h2p_style';
  styleEl.textContent = cssText;
  document.head.appendChild(styleEl);

  // 2. Build a container that is VISIBLE to html2canvas.
  //    - position: fixed at top-left (0,0)
  //    - z-index: 1 → behind the modal-backdrop (z-index 100)
  //    - pointer-events: none → doesn't block interaction
  const container = document.createElement('div');
  container.id = '__h2p_container';
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '820px';
  container.style.background = '#ffffff';
  container.style.color = '#0b1220';
  container.style.zIndex = '1';
  container.style.pointerEvents = 'none';
  container.style.fontFamily =
    "'Segoe UI', system-ui, -apple-system, sans-serif";
  container.innerHTML = pagesHtml.join('');
  document.body.appendChild(container);

  try {
    // 3. Wait for fonts + one render tick
    if (document.fonts?.ready) {
      try { await document.fonts.ready; } catch { /* ignore */ }
    }
    await new Promise((r) => setTimeout(r, 250));

    // 4. Render — let the injected CSS drive page breaks
    const html2pdf = (await import('html2pdf.js')).default;
    const safeName = (filename || 'document').replace(/[^\w.-]+/g, '-');

    await html2pdf()
      .set({
        ...A4_PORTRAIT,
        filename: safeName,
        // The injected CSS has `page-break-after: always` on .report-card,
        // so no extra `after: '...'` selector is needed. Adding one here
        // was causing blank pages.
        pagebreak: { mode: ['css'] },
      })
      .from(container)
      .save();
  } finally {
    // 5. Cleanup, even if it failed
    if (container.parentNode) container.parentNode.removeChild(container);
    if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
  }
}