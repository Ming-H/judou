import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/core/store';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const entry = await getStore().get(params.id);
  if (!entry) return NextResponse.json({ error: '文档不存在' }, { status: 404 });
  return NextResponse.json({ document: entry });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ok = await getStore().remove(params.id);
  if (!ok) return NextResponse.json({ error: '文档不存在' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
