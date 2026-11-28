/**
 * .docx Word export (v2.0.0 base, M11.3 upgrade): builds a minimal, clean
 * Office Open XML package (document.xml + [Content_Types].xml + rels +
 * docProps core metadata) as a STORED ZIP — no external dependency, ISO
 * 8601 metadata, heading styles, paragraph runs and NATIVE Word tables
 * (`w:tbl`) for the report chapters. M11.3: the Sections Droites Composées
 * chapter and every envelope summary ride real Word tables with embedded
 * document metadata (title / creator / dates in docProps/core.xml).
 */

/** One report chapter heading or body paragraph. */
export interface DocxBlock {
  kind: "heading" | "paragraph";
  text: string;
}

/** M11.3: a native Word table block (header row bold, hairline borders). */
export interface DocxTable {
  kind: "table";
  caption: string;
  header: string[];
  rows: string[][];
}

function esc(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** One `<w:tc>` cell with a single left-aligned run. */
function tableCell(text: string, bold: boolean): string {
  const runProps = bold ? "<w:rPr><w:b/></w:rPr>" : "";
  return `<w:tc><w:tcPr><w:tcMar><w:top w:w="40" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:start w:w="60" w:type="dxa"/><w:end w:w="60" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r>${runProps}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p></w:tc>`;
}

/** A bordered `w:tbl` with a bold header row (native Word table). */
function tableXml(table: DocxTable): string {
  const border = (side: string) =>
    `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>`;
  const header = `<w:tr>${table.header.map((cell) => tableCell(cell, true)).join("")}</w:tr>`;
  const body = table.rows
    .map((row) => `<w:tr>${row.map((cell) => tableCell(cell, false)).join("")}</w:tr>`)
    .join("");
  return `<w:p><w:pPr><w:spacing w:before="160" w:after="40"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${esc(table.caption)}</w:t></w:r></w:p>
<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${border("top")}${border("bottom")}${border("start")}${border("end")}${border("insideH")}${border("insideV")}</w:tblBorders></w:tblPr>${header}${body}</w:tbl>`;
}

function documentXml(blocks: (DocxBlock | DocxTable)[], meta: CoverMeta): string {
  const body = blocks
    .map((block) => {
      if (block.kind === "table") {
        return tableXml(block);
      }
      return block.kind === "heading"
        ? `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">${esc(block.text)}</w:t></w:r></w:p>`
        : `<w:p><w:r><w:t xml:space="preserve">${esc(block.text)}</w:t></w:r></w:p>`;
    })
    .join("");
  const cover = `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${esc(meta.firm)}</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">${esc(meta.engineer)} / ${esc(meta.checker)}</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Révision ${esc(meta.revision)} — ${new Date().toISOString().slice(0, 10)}</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">${esc(meta.scope ?? "")}</w:t></w:r></w:p>
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
  /** M11.3: normative scope line printed on the cover (EN 1990–1999…). */
  scope?: string;
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
export function downloadDocx(
  blocks: (DocxBlock | DocxTable)[],
  meta: CoverMeta,
  filename: string,
): void {
  const docBytes = new TextEncoder().encode(documentXml(blocks, meta));
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const coreBytes = new TextEncoder().encode(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>RDM Studio — Rapport de calcul : ${esc(meta.firm)}</dc:title><dc:creator>${esc(meta.engineer)}</dc:creator><cp:lastModifiedBy>${esc(meta.engineer)}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified><dc:description>${esc(meta.scope ?? "")}</dc:description></cp:coreProperties>`,
  );
  const contentTypes = new TextEncoder().encode(
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`,
  );
  const rels = new TextEncoder().encode(
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`,
  );
  const central: { name: string; data: Uint8Array; offset: number }[] = [];
  const parts: Uint8Array[] = [];
  let offset = 0;
  for (const [name, data] of [
    ["[Content_Types].xml", contentTypes],
    ["_rels/.rels", rels],
    ["docProps/core.xml", coreBytes],
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
