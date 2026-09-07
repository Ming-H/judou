import { describe, expect, it } from 'vitest';
import { extractLargeNumbers, parseNumberString, readNumber, readSelection } from '../src/core/numberReadability';

describe('数字句读（PRD F3 验收）', () => {
  it('AC3.1 千分位巨数 → 亿 + 万', () => {
    const r = readNumber('2,345,678,901.23')!;
    expect(r.yi).toBe('23.46 亿');
    expect(r.wan).toBe('234,567.89 万');
    expect(r.yuan).toBe(2345678901.23);
  });

  it('AC3.2 整数亿 → 亿 + 无小数万的万', () => {
    const r = readNumber('153,000,000')!;
    expect(r.yi).toBe('1.53 亿');
    expect(r.wan).toBe('15,300 万');
  });

  it('1 亿以下只给万', () => {
    const r = readNumber('23,456,789')!;
    expect(r.yi).toBeUndefined();
    expect(r.wan).toBe('2,345.68 万');
  });

  it('AC3.3 低于 1 万不换算', () => {
    expect(readNumber('9,800')).toBeNull();
    expect(readNumber('123')).toBeNull();
  });

  it('AC3.4 划选文本提取多个可换算数字，小数字被过滤', () => {
    const rs = readSelection('营业收入2,345,678,901.23元，增长153,000,000%，费用9,800元');
    expect(rs.map((r) => r.yi ?? r.wan)).toEqual(['23.46 亿', '1.53 亿']);
  });

  it('无千分位的连续 ≥6 位数字也识别', () => {
    expect(readNumber('23456789')!.wan).toBe('2,345.68 万');
    expect(extractLargeNumbers('合同负债1204000000.50元')).toEqual(['1204000000.50']);
  });

  it('parseNumberString 去千分位', () => {
    expect(parseNumberString('1,234,567')).toBe(1234567);
  });
});
