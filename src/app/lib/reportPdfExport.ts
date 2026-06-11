import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

function resolveCssColorForCanvas(value: string, mode: 'color' | 'background'): string {
  const v = value.trim();
  if (!v || !/oklch|lch\(|lab\(/i.test(v)) return v;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;';
  if (mode === 'background') probe.style.background = v;
  else probe.style.color = v;
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const out = mode === 'background' ? cs.backgroundColor : cs.color;
  probe.remove();
  if (out && !/oklch|lch\(|lab\(/i.test(out)) return out;
  return mode === 'background' ? '#ffffff' : '#111827';
}

const PDF_INLINE_PROPS = [
  'color', 'background-color', 'border', 'border-radius', 'font-family', 'font-size', 'font-weight',
  'line-height', 'text-align', 'padding', 'margin', 'width', 'height', 'display', 'flex-direction',
  'gap', 'overflow', 'box-sizing',
];

function stripUnsupportedPdfStylesFromClone(clonedDoc: Document) {
  clonedDoc.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => n.parentNode?.removeChild(n));
}

function resolveCssValueWithProbe(prop: string, val: string): string {
  const v = val.trim();
  if (!v || !/oklch|lch\(|lab\(/i.test(v)) return v;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:1px;visibility:hidden;';
  try {
    probe.style.setProperty(prop, v);
  } catch {
    probe.remove();
    return '';
  }
  document.body.appendChild(probe);
  let resolved = '';
  try {
    resolved = getComputedStyle(probe).getPropertyValue(prop).trim();
  } finally {
    probe.remove();
  }
  if (resolved && !/oklch|lch\(|lab\(/i.test(resolved)) return resolved;
  if (/shadow/i.test(prop)) return 'none';
  if (/color|fill|stroke/i.test(prop)) return '#111827';
  return '';
}

function sanitizeHtml2CanvasCopiedStylesInSubtree(root: HTMLElement) {
  const nodes: Element[] = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    node.removeAttribute('class');
    const props = new Set<string>();
    for (let i = 0; i < node.style.length; i++) props.add(node.style.item(i));
    for (const prop of props) {
      const val = node.style.getPropertyValue(prop).trim();
      if (!val || !/oklch|lch\(|lab\(/i.test(val)) continue;
      const fixed = resolveCssValueWithProbe(prop, val);
      if (fixed && !/oklch|lch\(|lab\(/i.test(fixed)) node.style.setProperty(prop, fixed);
      else node.style.removeProperty(prop);
    }
  }
}

function inlinePdfCloneStyles(sourceRoot: HTMLElement, cloneRoot: HTMLElement) {
  const walk = (src: Element, dst: Element) => {
    if (src instanceof HTMLElement && dst instanceof HTMLElement) {
      dst.removeAttribute('class');
      const cs = window.getComputedStyle(src);
      for (const prop of PDF_INLINE_PROPS) {
        let val = cs.getPropertyValue(prop).trim();
        if (!val) continue;
        if (/oklch|lch\(|lab\(/i.test(val)) {
          if (prop.includes('color') || prop === 'background-color') {
            val = resolveCssColorForCanvas(val, prop === 'background-color' ? 'background' : 'color');
          } else continue;
        }
        try {
          dst.style.setProperty(prop, val);
        } catch {
          /* ignore */
        }
      }
    }
    const sc = Array.from(src.children);
    const dc = Array.from(dst.children);
    for (let i = 0; i < Math.min(sc.length, dc.length); i++) walk(sc[i]!, dc[i]!);
  };
  walk(sourceRoot, cloneRoot);
}

function appendCanvasToPdfMultiPage(pdf: jsPDF, canvas: HTMLCanvasElement, marginMm: number): void {
  const imgData = canvas.toDataURL('image/png', 1.0);
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  const pageInnerH = pdfH - 2 * marginMm;
  const imgW = pdfW - 2 * marginMm;
  const imgH = (canvas.height * imgW) / canvas.width;
  let heightLeft = imgH;
  pdf.addImage(imgData, 'PNG', marginMm, marginMm, imgW, imgH);
  heightLeft -= pageInnerH;
  while (heightLeft > 0) {
    const y = marginMm - (imgH - heightLeft);
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', marginMm, y, imgW, imgH);
    heightLeft -= pageInnerH;
  }
}

/** Captura secciones DOM marcadas con `sectionAttr` y genera un PDF multipágina. */
export async function downloadDomSectionsAsPdf(opts: {
  root: HTMLElement;
  sectionAttr?: string;
  filename: string;
  marginMm?: number;
  scale?: number;
}): Promise<void> {
  const attr = opts.sectionAttr ?? 'data-pdf-section';
  const sections = Array.from(root.querySelectorAll(`[${attr}]`)).filter(
    (n): n is HTMLElement => n instanceof HTMLElement
  );
  if (!sections.length) throw new Error('no pdf sections');
  const margin = opts.marginMm ?? 10;
  const scale = opts.scale ?? 1.55;
  const pdf = new jsPDF('p', 'mm', 'a4');
  let first = true;
  for (const section of sections) {
    const canvas = await html2canvas(section, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: section.scrollWidth,
      windowHeight: section.scrollHeight,
      onclone: (clonedDoc, clonedEl) => {
        stripUnsupportedPdfStylesFromClone(clonedDoc);
        const cloneRoot =
          clonedEl instanceof HTMLElement
            ? clonedEl
            : (clonedDoc.querySelector(`[${attr}]`) as HTMLElement | null);
        if (cloneRoot instanceof HTMLElement) inlinePdfCloneStyles(section, cloneRoot);
        if (cloneRoot instanceof HTMLElement) sanitizeHtml2CanvasCopiedStylesInSubtree(cloneRoot);
      },
    });
    if (!first) pdf.addPage();
    first = false;
    appendCanvasToPdfMultiPage(pdf, canvas, margin);
  }
  pdf.save(opts.filename);
}
