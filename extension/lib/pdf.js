// Dependency-free PDF writer: real (selectable, ATS-parseable) text in the
// standard Helvetica family, rectangles/lines, and JPEG images. API uses a
// top-left origin in points (letter = 612 x 792).

const FONTS = { regular: 'F1', bold: 'F2', italic: 'F3' };
const FONT_CSS = { regular: '', bold: 'bold ', italic: 'italic ' };

// Arial is metric-compatible with Helvetica, so canvas measurement matches the PDF.
let measureCtx = null;
function measure(str, size, font) {
  if (!measureCtx && typeof OffscreenCanvas !== 'undefined') measureCtx = new OffscreenCanvas(8, 8).getContext('2d');
  if (measureCtx) {
    measureCtx.font = `${FONT_CSS[font] || ''}${size}px Arial, Helvetica, sans-serif`;
    return measureCtx.measureText(str).width;
  }
  return str.length * size * (font === 'bold' ? 0.56 : 0.52); // fallback estimate (tests)
}

// Unicode -> WinAnsi so smart quotes, dashes and bullets survive.
const WIN = { '•': 0x95, '–': 0x96, '—': 0x97, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '…': 0x85, '€': 0x80, '™': 0x99 };
function pdfString(str) {
  let out = '';
  for (const ch of String(str)) {
    let code = WIN[ch] ?? ch.codePointAt(0);
    if (code > 255) code = 63; // '?'
    if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
    else if (code < 32 || code > 126) out += '\\' + code.toString(8).padStart(3, '0');
    else out += ch;
  }
  return `(${out})`;
}

const hexToRgb = (hex) => {
  const h = (hex || '#000000').replace('#', '');
  return [0, 2, 4].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
};

export class PDFDoc {
  constructor({ width = 612, height = 792 } = {}) {
    this.W = width; this.H = height;
    this.pages = [];
    this.images = [];
    this.addPage();
  }

  addPage() { this.page = []; this.pages.push(this.page); return this; }

  widthOf(str, size, font = 'regular') { return measure(str, size, font); }

  wrap(str, maxWidth, size, font = 'regular') {
    const lines = [];
    for (const para of String(str || '').split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const test = line ? `${line} ${word}` : word;
        if (this.widthOf(test, size, font) <= maxWidth || !line) line = test;
        else { lines.push(line); line = word; }
      }
      lines.push(line);
    }
    return lines;
  }

  text(str, x, y, { size = 10, font = 'regular', color = '#111111' } = {}) {
    this.page.push(`BT /${FONTS[font]} ${size} Tf ${hexToRgb(color)} rg ${x.toFixed(2)} ${(this.H - y).toFixed(2)} Td ${pdfString(str)} Tj ET`);
  }

  rect(x, y, w, h, color) {
    this.page.push(`${hexToRgb(color)} rg ${x.toFixed(2)} ${(this.H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }

  line(x1, y1, x2, y2, color = '#cccccc', width = 0.75) {
    this.page.push(`${hexToRgb(color)} RG ${width} w ${x1.toFixed(2)} ${(this.H - y1).toFixed(2)} m ${x2.toFixed(2)} ${(this.H - y2).toFixed(2)} l S`);
  }

  // jpeg: Uint8Array of a baseline RGB JPEG. circle: clip to a circle.
  image(jpeg, pxW, pxH, x, y, w, h, { circle = false } = {}) {
    const name = `Im${this.images.length + 1}`;
    this.images.push({ name, jpeg, pxW, pxH });
    const by = this.H - y - h;
    let ops = 'q ';
    if (circle) {
      const r = w / 2, cx = x + r, cy = by + r, k = 0.5523 * r;
      ops += `${cx + r} ${cy} m ${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} c ${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} c `
        + `${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} c ${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} c W n `;
    }
    ops += `${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${by.toFixed(2)} cm /${name} Do Q`;
    this.page.push(ops);
  }

  toBytes({ title = '', author = '' } = {}) {
    const enc = (s) => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff; return b; };
    const chunks = [];
    const offsets = [];
    let pos = 0;
    const write = (part) => { const b = typeof part === 'string' ? enc(part) : part; chunks.push(b); pos += b.length; };
    const objects = []; // [id, parts[]]
    const add = (parts) => { objects.push(parts); return objects.length; };

    const catalogId = add(null);
    const pagesId = add(null);
    const fontIds = ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique'].map((base) =>
      add([`<< /Type /Font /Subtype /Type1 /BaseFont /${base} /Encoding /WinAnsiEncoding >>`]));
    const imageIds = this.images.map((im) => add([
      `<< /Type /XObject /Subtype /Image /Width ${im.pxW} /Height ${im.pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.jpeg.length} >>\nstream\n`,
      im.jpeg, '\nendstream']));
    const xobj = this.images.map((im, i) => `/${im.name} ${imageIds[i]} 0 R`).join(' ');
    const resources = `<< /Font << /F1 ${fontIds[0]} 0 R /F2 ${fontIds[1]} 0 R /F3 ${fontIds[2]} 0 R >>${xobj ? ` /XObject << ${xobj} >>` : ''} >>`;
    const pageIds = this.pages.map((ops) => {
      const stream = ops.join('\n');
      const contentId = add([`<< /Length ${enc(stream).length} >>\nstream\n${stream}\nendstream`]);
      return add([`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${this.W} ${this.H}] /Resources ${resources} /Contents ${contentId} 0 R >>`]);
    });
    objects[catalogId - 1] = [`<< /Type /Catalog /Pages ${pagesId} 0 R >>`];
    objects[pagesId - 1] = [`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`];
    const infoId = add([`<< /Title ${pdfString(title)} /Author ${pdfString(author)} /Producer (Job Hunt OS) >>`]);

    write('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
    objects.forEach((parts, i) => {
      offsets[i] = pos;
      write(`${i + 1} 0 obj\n`);
      parts.forEach(write);
      write('\nendobj\n');
    });
    const xrefPos = pos;
    write(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
    offsets.forEach((o) => write(`${String(o).padStart(10, '0')} 00000 n \n`));
    write(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

    const out = new Uint8Array(pos);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }
}

export function dataUrlToBytes(dataUrl) {
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
