import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { getStore } from '@/core/store';

export const runtime = 'nodejs';

/** PDF 文件流（内容不变，长缓存） */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const store = getStore();
  const entry = await store.get(params.id);
  if (!entry) return NextResponse.json({ error: '文档不存在' }, { status: 404 });
  const filePath = store.filePath(params.id);
  if (!filePath) return NextResponse.json({ error: '文件缺失' }, { status: 404 });
  const info = await stat(filePath);
  const stream = Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream;
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(info.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
