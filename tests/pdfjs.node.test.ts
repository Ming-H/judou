import { describe, expect, it } from 'vitest';
import { makePdf } from './helpers/makePdf';

/**
 * 集成测试：pdfjs（Node legacy build）加载真实 PDF 并抽取文本层。
 * 验证阅读器"文本层→数字句读"链路的数据源（getTextContent）真实可用。
 */
describe('pdfjs 文本层抽取', () => {
  it('构造的 PDF 可解析且文本层包含目标数字', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = makePdf('Revenue 2,345,678,901.23 yuan');
    const pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
    expect(pdf.numPages).toBe(1);
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    const text = content.items.map((i: any) => (i.str ?? '') as string).join('');
    expect(text).toContain('2,345,678,901.23');
  });
});
