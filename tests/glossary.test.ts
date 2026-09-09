import { describe, expect, it } from 'vitest';
import { GLOSSARY, lookupTerm, matchTerms } from '../src/core/glossary';

describe('财报术语词典', () => {
  it('词典规模与结构完整', () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(90);
    for (const e of GLOSSARY) {
      expect(e.term.length).toBeGreaterThanOrEqual(2);
      expect(e.plain.length).toBeGreaterThan(5);
      expect(e.watch.length).toBeGreaterThan(5);
      expect(e.category).toBeTruthy();
    }
  });

  it('span 文本命中术语', () => {
    const hits = matchTerms('其中：合同负债 1,204,000,000.00 元');
    expect(hits.some((e) => e.term === '合同负债')).toBe(true);
  });

  it('长词优先：归母净利润命中时不再列净利润', () => {
    const hits = matchTerms('归属于上市公司股东的净利润 360,860,000.00');
    expect(hits.some((e) => e.term === '归母净利润')).toBe(true);
    expect(hits.some((e) => e.term === '净利润')).toBe(false);
  });

  it('独立出现的净利润正常命中', () => {
    const hits = matchTerms('本报告期净利润（含少数股东损益）');
    expect(hits.some((e) => e.term === '净利润')).toBe(true);
  });

  it('别名可命中：ROE 与 加权平均净资产收益率 同条', () => {
    const a = matchTerms('加权平均净资产收益率 10.94%');
    const b = matchTerms('ROE 10.94%');
    expect(a[0].term).toBe(b[0].term);
  });

  it('普通文本不误报', () => {
    expect(matchTerms('公司注册情况在报告期无变化')).toEqual([]);
  });

  it('lookupTerm 精确/别名命中，长文本不命中', () => {
    expect(lookupTerm('合同负债')?.term).toBe('合同负债');
    expect(lookupTerm('EBITDA')?.term).toBe('息税折旧摊销前利润');
    expect(lookupTerm('这句活很长不是术语')).toBeNull();
    expect(lookupTerm('')).toBeNull();
  });
});
