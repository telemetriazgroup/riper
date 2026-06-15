import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/** html2canvas no parsea oklch/lab; Tailwind v4 los usa en hojas de estilo. */
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

const PDF_INLINE_PROPS: string[] = [
  'color',
  'background-color',
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-radius',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'outline',
  'outline-color',
  'box-shadow',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'text-align',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'display',
  'flex-direction',
  'flex-wrap',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'justify-content',
  'align-items',
  'align-content',
  'gap',
  'grid-template-columns',
  'grid-template-rows',
  'overflow',
  'opacity',
  'visibility',
  'position',
  'top',
  'left',
  'right',
  'bottom',
  'z-index',
  'box-sizing',
  'white-space',
  'text-decoration',
  'text-decoration-color',
  'vertical-align',
];

const OKLCH_RE = /oklch|lch\(|lab\(/i;

function stripUnsupportedPdfStylesFromClone(clonedDoc: Document) {
  clonedDoc.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => {
    n.parentNode?.removeChild(n);
  });
  try {
    (clonedDoc as Document & { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets = [];
  } catch {
    /* ignore */
  }
}

function resolveCssValueWithProbe(prop: string, val: string): string {
  const v = val.trim();
  if (!v || !OKLCH_RE.test(v)) return v;
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:absolute;left:-9999px;top:0;width:1px;height:1px;visibility:hidden;pointer-events:none;opacity:0;';
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
  if (resolved && !OKLCH_RE.test(resolved)) return resolved;
  if (/shadow/i.test(prop)) return 'none';
  if (
    /color|fill|stroke|stop/i.test(prop) ||
    prop === 'background-color' ||
    prop === 'outline-color' ||
    prop === 'caret-color' ||
    prop === 'accent-color'
  ) {
    return '#111827';
  }
  return '';
}

/** Elimina oklch/lab/lch de estilos inline copiados por html2canvas. */
export function sanitizeHtml2CanvasCopiedStylesInSubtree(root: HTMLElement) {
  const nodes: Element[] = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const node of nodes) {
    if (node instanceof HTMLElement) {
      node.removeAttribute('class');
      const props = new Set<string>();
      for (let i = 0; i < node.style.length; i++) {
        props.add(node.style.item(i));
      }
      for (const prop of props) {
        const val = node.style.getPropertyValue(prop).trim();
        if (!val || !OKLCH_RE.test(val)) continue;
        const fixed = resolveCssValueWithProbe(prop, val);
        if (fixed && !OKLCH_RE.test(fixed)) {
          node.style.setProperty(prop, fixed);
        } else {
          node.style.removeProperty(prop);
        }
      }
    }
    if (node instanceof SVGElement) {
      node.removeAttribute('class');
      for (const attr of ['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color'] as const) {
        const v = node.getAttribute(attr);
        if (v && OKLCH_RE.test(v)) {
          node.setAttribute(attr, resolveCssColorForCanvas(v, 'color'));
        }
      }
      const st = node.getAttribute('style');
      if (st && OKLCH_RE.test(st)) {
        const kept = st
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((decl) => !OKLCH_RE.test(decl));
        if (kept.length) node.setAttribute('style', kept.join('; '));
        else node.removeAttribute('style');
      }
    }
  }
}

function inlinePdfCloneStyles(sourceRoot: HTMLElement, cloneRoot: HTMLElement) {
  const maybeSanitize = (prop: string, val: string): string => {
    if (!OKLCH_RE.test(val)) return val;
    if (
      prop === 'border' ||
      prop === 'outline' ||
      prop === 'box-shadow' ||
      (prop.startsWith('border-') && !prop.includes('radius'))
    ) {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;';
      try {
        probe.style.setProperty(prop, val);
      } catch {
        return val;
      }
      document.body.appendChild(probe);
      const resolved = getComputedStyle(probe).getPropertyValue(prop);
      probe.remove();
      if (resolved && !OKLCH_RE.test(resolved)) return resolved.trim();
    }
    const colorish =
      prop.includes('color') || prop === 'text-decoration' || prop === 'text-decoration-color';
    if (!colorish) return val;
    if (prop === 'background-color') return resolveCssColorForCanvas(val, 'background');
    return resolveCssColorForCanvas(val, 'color');
  };

  const walk = (src: Element, dst: Element) => {
    if (src instanceof HTMLElement && dst instanceof HTMLElement) {
      dst.removeAttribute('class');
      const cs = window.getComputedStyle(src);
      for (const prop of PDF_INLINE_PROPS) {
        let val = cs.getPropertyValue(prop).trim();
        if (!val) continue;
        val = maybeSanitize(prop, val);
        if (OKLCH_RE.test(val)) continue;
        try {
          dst.style.setProperty(prop, val);
        } catch {
          /* ignore */
        }
      }
    } else if (src instanceof SVGElement && dst instanceof SVGElement) {
      dst.removeAttribute('class');
      try {
        const cs = window.getComputedStyle(src);
        const fill = cs.getPropertyValue('fill').trim();
        const stroke = cs.getPropertyValue('stroke').trim();
        if (fill && fill !== 'none') {
          dst.setAttribute(
            'fill',
            OKLCH_RE.test(fill) ? resolveCssColorForCanvas(fill, 'color') : fill
          );
        }
        if (stroke && stroke !== 'none') {
          dst.setAttribute(
            'stroke',
            OKLCH_RE.test(stroke) ? resolveCssColorForCanvas(stroke, 'color') : stroke
          );
        }
      } catch {
        /* ignore */
      }
    }

    const sc = Array.from(src.children);
    const dc = Array.from(dst.children);
    for (let i = 0; i < Math.min(sc.length, dc.length); i++) {
      walk(sc[i]!, dc[i]!);
    }
  };

  walk(sourceRoot, cloneRoot);
}

function appendCanvasToPdfMultiPage(pdf: jsPDF, canvas: HTMLCanvasElement, marginMm: number): void {
  const imgData = canvas.toDataURL('image/png', 1.0);
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  const innerW = pdfW - 2 * marginMm;
  const innerH = pdfH - 2 * marginMm;
  const imgH = (canvas.height * innerW) / canvas.width;

  if (imgH <= innerH + 0.5) {
    pdf.addImage(imgData, 'PNG', marginMm, marginMm, innerW, imgH);
    return;
  }

  let offsetY = 0;
  let pageIndex = 0;
  while (offsetY < imgH - 0.5) {
    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(imgData, 'PNG', marginMm, marginMm - offsetY, innerW, imgH);
    offsetY += innerH;
    pageIndex += 1;
  }
}

type SectionCaptureSnap = {
  width: string;
  maxWidth: string;
  boxSizing: string;
  overflow: string;
  margin: string;
};

function snapSectionLayout(section: HTMLElement): SectionCaptureSnap {
  const cs = section.style;
  return {
    width: cs.width,
    maxWidth: cs.maxWidth,
    boxSizing: cs.boxSizing,
    overflow: cs.overflow,
    margin: cs.margin,
  };
}

function applySectionCaptureLayout(section: HTMLElement, captureWidthPx: number) {
  section.style.width = `${captureWidthPx}px`;
  section.style.maxWidth = `${captureWidthPx}px`;
  section.style.boxSizing = 'border-box';
  section.style.overflow = 'visible';
  section.style.margin = '0';
}

function restoreSectionLayout(section: HTMLElement, snap: SectionCaptureSnap) {
  section.style.width = snap.width;
  section.style.maxWidth = snap.maxWidth;
  section.style.boxSizing = snap.boxSizing;
  section.style.overflow = snap.overflow;
  section.style.margin = snap.margin;
}

function prepareClonedSectionForCanvas(
  clonedDoc: Document,
  clonedEl: Element | null,
  sourceSection: HTMLElement,
  attrName: string
): HTMLElement | null {
  stripUnsupportedPdfStylesFromClone(clonedDoc);

  if (clonedDoc.body instanceof HTMLElement) {
    sanitizeHtml2CanvasCopiedStylesInSubtree(clonedDoc.body);
  }

  const cloneRoot =
    clonedEl instanceof HTMLElement
      ? clonedEl
      : (clonedDoc.querySelector(`[${attrName}]`) as HTMLElement | null);

  if (cloneRoot instanceof HTMLElement) {
    inlinePdfCloneStyles(sourceSection, cloneRoot);
    sanitizeHtml2CanvasCopiedStylesInSubtree(cloneRoot);
  }

  if (clonedDoc.documentElement instanceof HTMLElement) {
    sanitizeHtml2CanvasCopiedStylesInSubtree(clonedDoc.documentElement);
  }

  return cloneRoot;
}

/** Recolecta nodos marcados con un atributo data-* (p. ej. data-ca-pdf-section). */
export function collectDomPdfSections(root: HTMLElement, attrName: string): HTMLElement[] {
  const isEl = (n: Element): n is HTMLElement => n instanceof HTMLElement;
  const bySelector = Array.from(root.querySelectorAll(`[${attrName}]`)).filter(isEl);
  if (bySelector.length) return bySelector;

  const byWalk: HTMLElement[] = [];
  for (const el of root.querySelectorAll('*')) {
    if (isEl(el) && el.hasAttribute(attrName)) byWalk.push(el);
  }
  if (byWalk.length) return byWalk;

  if (root.hasAttribute(attrName)) return [root];
  return [root];
}

function prepareSourceSectionForCapture(section: HTMLElement): () => void {
  type Snap = { el: HTMLElement; className: string | null; style: string };
  const htmlSnaps: Snap[] = [];
  const svgSnaps: { el: SVGElement; attr: string; value: string | null }[] = [];

  const htmlNodes = [section, ...Array.from(section.querySelectorAll('*'))].filter(
    (n): n is HTMLElement => n instanceof HTMLElement
  );

  for (const el of htmlNodes) {
    htmlSnaps.push({
      el,
      className: el.getAttribute('class'),
      style: el.getAttribute('style') || '',
    });
    el.removeAttribute('class');

    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    const color = cs.color;
    const borderColor = cs.borderColor;
    const parts: string[] = [];
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      parts.push(`background-color:${OKLCH_RE.test(bg) ? resolveCssColorForCanvas(bg, 'background') : bg}`);
    }
    if (color) {
      parts.push(`color:${OKLCH_RE.test(color) ? resolveCssColorForCanvas(color, 'color') : color}`);
    }
    if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)') {
      parts.push(
        `border-color:${OKLCH_RE.test(borderColor) ? resolveCssColorForCanvas(borderColor, 'color') : borderColor}`
      );
    }
    if (parts.length) el.setAttribute('style', parts.join(';'));
    else el.removeAttribute('style');
  }

  for (const el of section.querySelectorAll('svg, svg *')) {
    if (!(el instanceof SVGElement)) continue;
    el.removeAttribute('class');
    for (const attr of ['fill', 'stroke', 'stop-color'] as const) {
      const v = el.getAttribute(attr);
      if (v && OKLCH_RE.test(v)) {
        svgSnaps.push({ el, attr, value: v });
        el.setAttribute(attr, resolveCssColorForCanvas(v, 'color'));
      }
    }
    const st = el.getAttribute('style');
    if (st && OKLCH_RE.test(st)) {
      svgSnaps.push({ el, attr: '__style__', value: st });
      const kept = st
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((decl) => !OKLCH_RE.test(decl));
      if (kept.length) el.setAttribute('style', kept.join('; '));
      else el.removeAttribute('style');
    }
  }

  return () => {
    for (const { el, attr, value } of svgSnaps) {
      if (attr === '__style__') {
        if (value) el.setAttribute('style', value);
        else el.removeAttribute('style');
      } else if (value) el.setAttribute(attr, value);
      else el.removeAttribute(attr);
    }
    for (const snap of htmlSnaps) {
      if (snap.className) snap.el.setAttribute('class', snap.className);
      else snap.el.removeAttribute('class');
      if (snap.style) snap.el.setAttribute('style', snap.style);
      else snap.el.removeAttribute('style');
    }
  };
}

async function captureSectionToPdf(
  pdf: jsPDF,
  section: HTMLElement,
  opts: {
    marginMm: number;
    scale: number;
    attrName: string;
    isFirst: boolean;
    captureWidthPx: number;
    preserveSourceStyles?: boolean;
  }
): Promise<void> {
  const preserve = opts.preserveSourceStyles === true;
  const restoreStyles = preserve ? () => {} : prepareSourceSectionForCapture(section);
  const layoutSnap = snapSectionLayout(section);
  applySectionCaptureLayout(section, opts.captureWidthPx);
  const captureW = opts.captureWidthPx;
  try {
    const canvas = await html2canvas(section, {
      scale: opts.scale,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: captureW,
      windowWidth: captureW,
      windowHeight: Math.max(section.scrollHeight, section.offsetHeight, 1),
      onclone: (clonedDoc, clonedEl) => {
        prepareClonedSectionForCanvas(clonedDoc, clonedEl, section, opts.attrName);
        const cloneRoot =
          clonedEl instanceof HTMLElement
            ? clonedEl
            : (clonedDoc.querySelector(`[${opts.attrName}]`) as HTMLElement | null);
        if (cloneRoot instanceof HTMLElement) {
          cloneRoot.style.width = `${captureW}px`;
          cloneRoot.style.maxWidth = `${captureW}px`;
          cloneRoot.style.boxSizing = 'border-box';
          cloneRoot.style.overflow = 'visible';
          cloneRoot.style.backgroundColor = '#ffffff';
          cloneRoot.style.margin = '0';
          cloneRoot.style.padding = cloneRoot.style.padding || '';
        }
      },
    });
    if (!opts.isFirst) pdf.addPage();
    appendCanvasToPdfMultiPage(pdf, canvas, opts.marginMm);
  } finally {
    restoreSectionLayout(section, layoutSnap);
    restoreStyles();
  }
}

/** Ancho útil A4: 210 mm − 2×15 mm margen ≈ 680 px @ 96 dpi */
export const PDF_A4_CONTENT_WIDTH_PX = Math.round((180 / 25.4) * 96);

export type DomSectionsPdfOptions = {
  root: HTMLElement;
  sectionAttr?: string;
  sections?: HTMLElement[];
  marginMm?: number;
  scale?: number;
  captureWidthPx?: number;
  preserveSourceStyles?: boolean;
};

async function buildDomSectionsPdfDoc(opts: DomSectionsPdfOptions): Promise<import('jspdf').jsPDF> {
  const attrName = opts.sectionAttr ?? 'data-pdf-section';
  const margin = opts.marginMm ?? 15;
  const scale = opts.scale ?? 2;
  const captureWidthPx = opts.captureWidthPx ?? PDF_A4_CONTENT_WIDTH_PX;
  const preserve = opts.preserveSourceStyles === true;
  const sections =
    opts.sections?.length
      ? opts.sections.filter((n): n is HTMLElement => n instanceof HTMLElement)
      : collectDomPdfSections(opts.root, attrName);

  if (!sections.length) {
    throw new Error('no pdf sections');
  }

  const rootSnap = snapSectionLayout(opts.root);
  applySectionCaptureLayout(opts.root, captureWidthPx);
  if (!preserve) window.dispatchEvent(new Event('resize'));

  const pdf = new jsPDF('p', 'mm', 'a4');
  let isFirst = true;
  try {
    for (const section of sections) {
      await captureSectionToPdf(pdf, section, {
        marginMm: margin,
        scale,
        attrName,
        isFirst,
        captureWidthPx,
        preserveSourceStyles: preserve,
      });
      isFirst = false;
    }
    return pdf;
  } finally {
    restoreSectionLayout(opts.root, rootSnap);
  }
}

export async function buildDomSectionsPdfBytes(opts: DomSectionsPdfOptions): Promise<Uint8Array> {
  const pdf = await buildDomSectionsPdfDoc(opts);
  return new Uint8Array(pdf.output('arraybuffer'));
}

export async function downloadDomSectionsAsPdf(
  opts: DomSectionsPdfOptions & { filename: string }
): Promise<void> {
  const pdf = await buildDomSectionsPdfDoc(opts);
  pdf.save(opts.filename);
}
