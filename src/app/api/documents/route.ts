import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/core/store';
import { isPdfBuffer, MAX_PDF_BYTES } from '@/core/pdf';

export const runtime = 'nodejs';

export async function GET() {
  const documents = await getStore().list();
  return NextResponse.json({ documents });
}

/** 上传导入（multipart，支持多文件）。校验 %PDF- 魔数与大小上限。 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll('file').filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: '未收到文件' }, { status: 400 });
    }
    const store = getStore();
    const created = [];
    const rejected: string[] = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      if (!isPdfBuffer(buffer)) {
        rejected.push(`${file.name}（非 PDF）`);
        continue;
      }
      if (buffer.length > MAX_PDF_BYTES) {
        rejected.push(`${file.name}（超过 100MB）`);
        continue;
      }
      created.push(await store.create({ buffer, title: file.name, source: 'upload' }));
    }
    if (created.length === 0) {
      return NextResponse.json({ error: `全部文件被拒绝：${rejected.join('、')}` }, { status: 400 });
    }
    return NextResponse.json({ documents: created, rejected });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
