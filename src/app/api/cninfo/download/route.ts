import { NextRequest, NextResponse } from 'next/server';
import { downloadAnnouncementPdf } from '@/core/cninfo';
import { isPdfBuffer, MAX_PDF_BYTES } from '@/core/pdf';
import { getStore } from '@/core/store';

export const runtime = 'nodejs';

/** 巨潮公告 PDF 下载入库。sourceUrl 去重：已入库直接复用。 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { url?: string; title?: string };
    const url = body.url?.trim() ?? '';
    const title = body.title?.trim() || '未命名公告';
    if (!url) return NextResponse.json({ error: '缺少 url' }, { status: 400 });

    const store = getStore();
    const existing = await store.findBySourceUrl(url);
    if (existing) return NextResponse.json({ document: existing, deduplicated: true });

    const buffer = await downloadAnnouncementPdf(url);
    if (!isPdfBuffer(buffer)) {
      return NextResponse.json({ error: '下载内容不是有效 PDF' }, { status: 502 });
    }
    if (buffer.length > MAX_PDF_BYTES) {
      return NextResponse.json({ error: 'PDF 超过 100MB 上限' }, { status: 502 });
    }
    const document = await store.create({ buffer, title, source: 'cninfo', sourceUrl: url });
    return NextResponse.json({ document });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
