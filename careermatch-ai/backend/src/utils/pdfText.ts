import pdfParse from "pdf-parse/lib/pdf-parse.js";

async function viaPdfJs(buf: Buffer): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false, disableFontFace: true }).promise;
  let text = "";
  const pages = Math.min(doc.numPages, 15);
  for (let i = 1; i <= pages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    let line = "";
    for (const it of content.items as any[]) {
      line += it.str;
      line += it.hasEOL ? "\n" : " ";
    }
    text += line + "\n";
  }
  return text;
}

/** Extract text from a PDF. Tries pdf-parse first, falls back to a newer pdf.js for files the old parser rejects. */
export async function extractPdfText(buf: Buffer): Promise<string> {
  const clean = (t: string) => t.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();
  try {
    const t = clean((await pdfParse(buf)).text);
    if (t.length >= 80) return t;
  } catch { /* fall through to pdf.js */ }
  return clean(await viaPdfJs(buf));
}
