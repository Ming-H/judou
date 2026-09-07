/**
 * 服务端逐页文本抽取（程序层，零 LLM 成本）。
 * 用 pdfjs legacy build 在 Node 侧抽取每页文本，JSON 缓存于 {dataDir}/pagetext/{docId}.json。
 * 这是数字索引/速览/问答上下文的统一数据源。
 */
import { promises as fs } from 'fs';
import path from 'path';

/* eslint-disable @typescript-eslint/no-explicit-any */
let pdfjsServer: any = null;
async function getPdfjs(): Promise<any> {
  if (!pdfjsServer) {
    pdfjsServer = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsServer;
}

function cachePath(dataDir: string, docId: string): string {
  return path.join(dataDir, 'pagetext', `${docId}.json`);
}

/** 获取整份文档的逐页文本（带缓存；首次抽取 200 页约数秒） */
export async function getPageTexts(dataDir: string, docId: string, pdfPath: string): Promise<string[]> {
  const file = cachePath(dataDir, docId);
  try {
    return JSON.parse(await fs.readFile(file, 'utf-8')) as string[];
  } catch {
    /* 无缓存则抽取 */
  }
  const data = new Uint8Array(await fs.readFile(pdfPath));
  const pdfjs = await getPdfjs();
  const pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item: any) => (item.str ?? '') as string).join(' '));
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(pages), 'utf-8');
  await fs.rename(tmp, file);
  return pages;
}
