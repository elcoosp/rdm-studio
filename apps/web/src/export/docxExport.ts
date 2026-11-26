/**
 * .docx Word export (v2.0.0): builds a minimal, clean Office Open XML
 * package (single document.xml + [Content_Types].xml + rels) as a ZIP
 * — no external dependency, ISO 8601 metadata, heading styles and
 * paragraph runs for the report chapters.
 */

/** One report chapter heading or body paragraph. */
export interface DocxBlock {
  kind: "heading" | "paragraph";
  text: string;
}

function esc(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function documentXml(blocks: DocxBlock[], meta: CoverMeta): string {
  const body = blocks
    .map((block) =>
      block.kind === "heading"
        ? `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">${esc(block.text)}</w:t></w:r></w:p>`
        : `<w:p><w:r><w:t xml:space="preserve">${esc(block.text)}</w:t></w:r></w:p>`,
    )
    .join("");
  const cover = `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${esc(meta.firm)}</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">${esc(meta.engineer)} / ${esc(meta.checker)}</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Révision ${esc(meta.revision)} — ${new Date().toISOString().slice(0, 10)}</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">${esc(meta.disclaimer)}</w:t></w:r></w:p>${
    // v2.1.1: Édition Découverte evaluation watermark (removed in Pro).
    meta.evaluation === true
      ? `
<w:p><w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">Édition Découverte — Évaluation non contractuelle</w:t></w:r></w:p>`
      : ""
  }`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${cover}
${body}
</w:body>
</w:document>`;
}

export interface CoverMeta {
  firm: string;
  engineer: string;
  checker: string;
  revision: string;
  disclaimer: string;
  /** v2.1.1: true under the free tier — adds the evaluation watermark. */
  evaluation?: boolean;
}

/** CRC-32 for the ZIP local headers. */
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipEntry(name: string, data: Uint8Array): Uint8Array {
  const nameBytes = new TextEncoder().encode(name);
  const crc = crc32(data);
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, data.length, true);
  view.setUint32(22, data.length, true);
  view.setUint16(26, nameBytes.length, true);
  header.set(nameBytes, 30);
  const end = new Uint8Array(header.length + data.length);
  end.set(header, 0);
  end.set(data, header.length);
  return end;
}

/** Builds and downloads the `.docx` package. */
export function downloadDocx(blocks: DocxBlock[], meta: CoverMeta, filename: string): void {
  const docBytes = new TextEncoder().encode(documentXml(blocks, meta));
  const contentTypes = new TextEncoder().encode(
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  const rels = new TextEncoder().encode(
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  const central: { name: string; data: Uint8Array; offset: number }[] = [];
  const parts: Uint8Array[] = [];
  let offset = 0;
  for (const [name, data] of [
    ["[Content_Types].xml", contentTypes],
    ["_rels/.rels", rels],
    ["word/document.xml", docBytes],
  ] as const) {
    const entry = zipEntry(name, data);
    parts.push(entry);
    central.push({ name, data, offset });
    offset += entry.length;
  }
  const centralRecords: Uint8Array[] = [];
  let centralSize = 0;
  for (const record of central) {
    const nameBytes = new TextEncoder().encode(record.name);
    const header = new Uint8Array(46 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint32(16, crc32(record.data), true);
    view.setUint32(20, record.data.length, true);
    view.setUint32(24, record.data.length, true);
    view.setUint16(28, nameBytes.length, true);
    view.setUint32(42, record.offset, true);
    header.set(nameBytes, 46);
    centralRecords.push(header);
    centralSize += header.length;
  }
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, central.length, true);
  endView.setUint16(10, central.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  const blob = new Blob([...parts, ...centralRecords, endRecord] as BlobPart[], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
