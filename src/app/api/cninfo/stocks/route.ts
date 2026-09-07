import { NextRequest, NextResponse } from 'next/server';
import { searchStocks } from '@/core/cninfo';

export const runtime = 'nodejs';

/** 巨潮股票检索：?keyword=松发股份 */
export async function GET(req: NextRequest) {
  const keyword = req.nextUrl.searchParams.get('keyword')?.trim();
  if (!keyword) return NextResponse.json({ candidates: [] });
  try {
    return NextResponse.json({ candidates: await searchStocks(keyword) });
  } catch (e) {
    return NextResponse.json({ error: `巨潮查询失败：${(e as Error).message}` }, { status: 502 });
  }
}
