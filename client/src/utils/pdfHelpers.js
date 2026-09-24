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
  },
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
};

/**
 * Convert a DOM element to a PDF and trigger a download.
 * @param {HTMLElement} element  The element to render (e.g. `.report-card`)
 * @param {string} filename      Download filename (will be sanitized)
 * @param {Object} [extra]       Extra options (e.g. pagebreak rules)
 */
export async function downloadElementAsPdf(element, filename, extra = {}) {
  if (!element) throw new Error('Nothing to export');

  // Wait for webfonts so text isn't blurred
  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* ignore */ }
  }

  // Dynamic import → the library only loads when needed
  const html2pdf = (await import('html2pdf.js')).default;

  const safeName = (filename || 'document').replace(/[^\w.-]+/g, '-');

  await html2pdf()
    .set({ ...A4_PORTRAIT, ...extra, filename: safeName })
    .from(element)
    .save();
}

/**
 * Convert a batch of HTML strings (one page each) to a single PDF.
 * Used for "Print/Download whole class".
 *
 * @param {string[]} pagesHtml   Array of HTML strings, each becomes one page
 * @param {string}   filename
 * @param {string}   cssText     Optional scoped CSS injected while rendering
 */
export async function downloadBatchAsPdf(pagesHtml, filename, cssText = '') {
  // 1. Temporarily inject the scoped styles
  const styleEl = document.createElement('style');
  styleEl.id = '__h2p_style';
  styleEl.textContent = cssText;
  document.head.appendChild(styleEl);

  // 2. Build an off-screen container
  const container = document.createElement('div');
  container.id = '__h2p_container';
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-10000px';
  container.style.width = '820px';
  container.style.background = '#ffffff';
  container.innerHTML = pagesHtml.join('');
  document.body.appendChild(container);

  try {
    // 3. Wait for fonts + a tick
    if (document.fonts?.ready) {
      try { await document.fonts.ready; } catch { /* ignore */ }
    }
    await new Promise((r) => setTimeout(r, 120));

    // 4. Render
    const html2pdf = (await import('html2pdf.js')).default;
    const safeName = (filename || 'document').replace(/[^\w.-]+/g, '-');

    await html2pdf()
      .set({
        ...A4_PORTRAIT,
        filename: safeName,
        // Each direct child becomes its own page
        pagebreak: { mode: ['css', 'legacy'], after: '.pdf-page' },
      })
      .from(container)
      .save();
  } finally {
    // 5. Cleanup, even if it failed
    if (container.parentNode) container.parentNode.removeChild(container);
    if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
  }
}