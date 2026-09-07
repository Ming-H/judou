import { describe, expect, it } from 'vitest';
import { cleanAnnouncements, isReportBody, withinDateRange } from '../src/core/cninfoFilter';

describe('巨潮财报正本筛选', () => {
  it('正本通过', () => {
    for (const t of ['2025年年度报告', '2026年半年度报告', '2026年第一季度报告', '2026年第三季度报告']) {
      expect(isReportBody(t), t).toBe(true);
    }
  });

  it('非正本被排除', () => {
    const rejected = [
      '2025年年度报告摘要',
      '2025年年度报告（英文版）',
      '2025年年度报告（更正后）',
      '2025年年度报告（更新后）',
      '2025年年度报告（补充披露）',
      '关于2025年年度报告披露提示的公告',
      '2025年年度报告问询函回复',
      '2025年年度股东大会通知',
      '2025年年度审计报告',
    ];
    for (const t of rejected) expect(isReportBody(t), t).toBe(false);
  });
});

describe('公告列表清洗', () => {
  it('去高亮标签、去重、按时间倒序', () => {
    const list = [
      { title: '<em>松发</em>股份：订单公告', time: '2026-05-20' },
      { title: '松发股份：订单公告', time: '2026-05-20' },
      { title: '更早公告', time: '2025-01-01' },
      { title: '', time: '2026-01-01' },
    ];
    const out = cleanAnnouncements(list);
    expect(out.map((x) => x.title)).toEqual(['松发股份：订单公告', '更早公告']);
  });
});

describe('日期复核（接口红线：seDate 结果必须二次过滤）', () => {
  it('范围内通过，范围外与非法格式拒绝', () => {
    expect(withinDateRange('2026-06-30', '2026-01-01', '2026-12-31')).toBe(true);
    expect(withinDateRange('2025-06-30', '2026-01-01', '2026-12-31')).toBe(false);
    expect(withinDateRange('', '2026-01-01', '2026-12-31')).toBe(false);
    expect(withinDateRange('2026/06/30', '2026-01-01', '2026-12-31')).toBe(false);
  });
});
