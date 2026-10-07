// Reads the patient email from a Word document so it can be edited without
// touching code:
//   Research Files/Email Files/Email Template.docx   - the email itself
//   Research Files/Email Files/Attachments/          - every file in here gets attached
//
// A .docx is a ZIP of XML files. This pulls word/document.xml out by hand
// (no dependencies) and converts paragraphs, bold/italic/underline, and
// links into the same simple <div> HTML the email used before - so the
// result looks the same on Mac and Windows and doesn't need Word installed.
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const TEMPLATE_NAME    = 'Email Template.docx';
const ATTACHMENTS_NAME = 'Attachments';
const DEFAULT_SUBJECT  = 'PREVENTABLE Trial - Study Information';

// Used only if the template file is missing or unreadable.
const FALLBACK_HTML = [
  '<div>{greeting}</div>',
  '<div><br></div>',
  '<div>Thank you for your interest in PREVENTABLE! Please see the attached study information.</div>',
  '<div><br></div>',
  '<div>Best,</div>',
].join('');

// ── Minimal ZIP reader ──
function readZipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 65558; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a .docx (zip) file');

  const count = buf.readUInt16LE(eocd + 10);
  let pos = buf.readUInt32LE(eocd + 16);
  const entries = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break;
    const method   = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const nameLen  = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const cmtLen   = buf.readUInt16LE(pos + 32);
    const localOff = buf.readUInt32LE(pos + 42);
    const name     = buf.toString('utf8', pos + 46, pos + 46 + nameLen);
    entries[name]  = { method, compSize, localOff };
    pos += 46 + nameLen + extraLen + cmtLen;
  }
  return {
    read(name) {
      const e = entries[name];
      if (!e) return null;
      const start = e.localOff + 30 + buf.readUInt16LE(e.localOff + 26) + buf.readUInt16LE(e.localOff + 28);
      const data  = buf.subarray(start, start + e.compSize);
      return (e.method === 0 ? data : zlib.inflateRawSync(data)).toString('utf8');
    },
  };
}

// ── document.xml → paragraphs of simple HTML ──
const isOn = (rPr, tag) => new RegExp(`<w:${tag}(?:\\s+w:val="(?!0"|false"|none")[^"]*")?\\s*/>`).test(rPr);

function runToHtml(runXml) {
  const rPr = (runXml.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/) || [, ''])[1];
  let html = '';
  const tokenRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:br\s*\/>|<w:tab\s*\/>|<w:noBreakHyphen\s*\/>/g;
  let m;
  while ((m = tokenRe.exec(runXml))) {
    if (m[0].startsWith('<w:t') && !m[0].startsWith('<w:tab')) html += m[1]; // already XML-escaped = HTML-safe
    else if (m[0].startsWith('<w:br')) html += '<br>';
    else if (m[0].startsWith('<w:tab')) html += '&nbsp;&nbsp;&nbsp;&nbsp;';
    else html += '-';
  }
  if (!html) return '';
  if (isOn(rPr, 'b')) html = `<b>${html}</b>`;
  if (isOn(rPr, 'i')) html = `<i>${html}</i>`;
  if (isOn(rPr, 'u')) html = `<u>${html}</u>`;
  return html;
}

function paragraphToHtml(pXml, links) {
  let html = '';
  let linkOpen = false;
  const re = /<w:hyperlink\b([^>]*)>|<\/w:hyperlink>|<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g;
  let m;
  while ((m = re.exec(pXml))) {
    if (m[0].startsWith('<w:hyperlink')) {
      const id  = (m[1].match(/r:id="([^"]+)"/) || [])[1];
      const url = id && links[id];
      linkOpen = !!url;
      if (url) html += `<a href='${url.replace(/'/g, '%27')}'>`;
    } else if (m[0] === '</w:hyperlink>') {
      if (linkOpen) html += '</a>';
      linkOpen = false;
    } else {
      html += runToHtml(m[2]);
    }
  }
  // Word splits one stretch of text into several identically-formatted
  // runs; rejoin them so placeholders like {greeting} survive intact.
  html = html.replace(/<\/(b|i|u)><\1>/g, '');
  if (/<w:numPr>/.test(pXml) && html) html = `&bull;&nbsp;${html}`;
  return html;
}

const toPlain = (html) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();

function parseDocx(buf) {
  const zip = readZipEntries(buf);
  const doc = zip.read('word/document.xml');
  if (!doc) throw new Error('no document.xml inside the .docx');

  const links = {};
  const rels = zip.read('word/_rels/document.xml.rels') || '';
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = (m[0].match(/\bId="([^"]+)"/) || [])[1];
    const target = (m[0].match(/\bTarget="([^"]+)"/) || [])[1];
    if (id && target && /hyperlink"/.test(m[0])) links[id] = target;
  }

  const paras = [];
  // "<w:p" followed by space, ">" or "/>" - i.e. not <w:pPr> etc.
  for (const m of doc.matchAll(/<w:p(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/w:p>)/g)) {
    paras.push(paragraphToHtml(m[1] || '', links));
  }
  return paras;
}

function loadEmailTemplate(emailDir) {
  let paras;
  try {
    paras = parseDocx(fs.readFileSync(path.join(emailDir, TEMPLATE_NAME)));
  } catch (err) {
    return { subject: DEFAULT_SUBJECT, html: FALLBACK_HTML, warning: `Could not read "${TEMPLATE_NAME}" (${err.message}) - used a basic built-in email instead.` };
  }

  // Optional first line: "Subject: ..."
  let subject = DEFAULT_SUBJECT;
  const first = paras.findIndex(p => toPlain(p));
  if (first !== -1 && /^subject\s*:/i.test(toPlain(paras[first]))) {
    subject = toPlain(paras[first]).replace(/^subject\s*:\s*/i, '') || DEFAULT_SUBJECT;
    paras.splice(0, first + 1);
  }

  // Trim blank paragraphs off both ends
  while (paras.length && !toPlain(paras[0])) paras.shift();
  while (paras.length && !toPlain(paras[paras.length - 1])) paras.pop();
  if (!paras.length) return { subject, html: FALLBACK_HTML, warning: `"${TEMPLATE_NAME}" is empty - used a basic built-in email instead.` };

  // If the author already separates paragraphs with empty lines, keep their
  // spacing as-is; if they rely on Word's automatic paragraph spacing (one
  // Enter per paragraph), add the blank line between paragraphs for them.
  const hasBlankLines = paras.some(p => !toPlain(p));
  const BLANK = '<div><br></div>';
  const html = paras
    .map(p => (toPlain(p) ? `<div>${p}</div>` : BLANK))
    .join(hasBlankLines ? '' : BLANK);

  return { subject, html };
}

function fillPlaceholders(text, values) {
  return text.replace(/\{\s*(greeting|first|last)\s*\}/gi, (m, key) => values[key.toLowerCase()] ?? m);
}

// Keeps the generated scripts pure ASCII (Windows PowerShell 5 misreads
// UTF-8 script files), so curly quotes and dashes from Word arrive intact.
const toAsciiHtml = (html) => html.replace(/&apos;/g, '&#39;').replace(/[^\x00-\x7F]/gu, ch => `&#${ch.codePointAt(0)};`);

function listAttachments(emailDir) {
  const dir = path.join(emailDir, ATTACHMENTS_NAME);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => !f.startsWith('.') && !f.startsWith('~$') && f.toLowerCase() !== 'thumbs.db' && f.toLowerCase() !== 'desktop.ini')
    .map(f => path.join(dir, f))
    .filter(f => fs.statSync(f).isFile())
    .sort((a, b) => a.localeCompare(b));
}

module.exports = { loadEmailTemplate, fillPlaceholders, toAsciiHtml, listAttachments, TEMPLATE_NAME, ATTACHMENTS_NAME };
