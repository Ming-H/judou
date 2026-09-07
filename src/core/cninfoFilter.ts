/**
 * 巨潮"财报正本"筛选规则（规则层）。
 * 必含财报正本特征；排除摘要/英文/更正/补充等干扰项。
 */

const REPORT_RE = /年度报告|半年度报告|第一季度报告|第三季度报告|季度报告/;

const EXCLUDE_RE =
  /摘要|英文|English|更正|补充|取消|撤销|延期|修订|更新|回执|议程|意见函|说明会|路演|采访|问答|索引|目录|翻译|已签署|披露提示|风险提示|问询|回复|会计师|审计报告/;

/** 是否为财报正本（用于"拉取历史财报"场景过滤） */
export function isReportBody(title: string): boolean {
  const t = title.replace(/<[^>]+>/g, '');
  return REPORT_RE.test(t) && !EXCLUDE_RE.test(t);
}

export interface TitledItem {
  title: string;
  time: string;
}

/** 公告列表清洗：去高亮标签、去空标题、按时间倒序、按标题去重 */
export function cleanAnnouncements<T extends TitledItem>(list: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  const sorted = [...list].sort((a, b) => b.time.localeCompare(a.time));
  for (const item of sorted) {
    const title = item.title.replace(/<[^>]+>/g, '').trim();
    if (!title) continue;
    if (seen.has(title)) continue;
    seen.add(title);
    out.push({ ...item, title });
  }
  return out;
}

/** 客户端日期复核：巨潮 seDate 之外的条目一律丢弃（接口红线：返回结果必须二次过滤） */
export function withinDateRange(time: string, beg: string, end: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(time)) return false;
  return time >= beg && time <= end;
}
