import { NextRequest, NextResponse } from 'next/server';
import { queryAnnouncements, REPORT_CATEGORY } from '@/core/cninfo';
import { cleanAnnouncements, isReportBody, withinDateRange } from '@/core/cninfoFilter';

export const runtime = 'nodejs';

/**
 * 巨潮公告列表：?code=&orgId=&scope=reports|all&year=
 * scope=reports 只返回财报正本（规则层筛选）；返回结果做客户端日期复核（接口红线）。
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const code = q.get('code')?.trim() ?? '';
  const orgId = q.get('orgId')?.trim() ?? '';
  const scope = q.get('scope') === 'all' ? 'all' : 'reports';
  const year = q.get('year')?.trim();
  if (!/^\d{6}$/.test(code) || !orgId) {
    return NextResponse.json({ error: '缺少 code/orgId' }, { status: 400 });
  }
  const thisYear = new Date().getFullYear();
  const yearNum = year && /^\d{4}$/.test(year) ? Number(year) : null;
  const beg = yearNum ? `${yearNum}-01-01` : `${thisYear - 3}-01-01`;
  const end = yearNum ? `${yearNum}-12-31` : `${thisYear}-12-31`;
  try {
    const raw = await queryAnnouncements({
      code,
      orgId,
      category: scope === 'reports' ? REPORT_CATEGORY : '',
      seDate: `${beg}~${end}`,
    });
    const filtered = raw
      .filter((a) => withinDateRange(a.time, beg, end))
      .filter((a) => (scope === 'reports' ? isReportBody(a.title) : true));
    return NextResponse.json({ announcements: cleanAnnouncements(filtered), range: { beg, end } });
  } catch (e) {
    return NextResponse.json({ error: `巨潮查询失败：${(e as Error).message}` }, { status: 502 });
  }
}
