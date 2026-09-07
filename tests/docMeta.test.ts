import { describe, expect, it } from 'vitest';
import { parseDocMeta } from '../src/core/docMeta';

describe('文档元信息解析', () => {
  it('巨潮标题：公司：年份+报告期', () => {
    const m = parseDocMeta('松发股份：2026年半年度报告');
    expect(m.company).toBe('松发股份');
    expect(m.year).toBe(2026);
    expect(m.docType).toBe('半年报');
  });

  it('文件名：下划线分隔', () => {
    const m = parseDocMeta('美迪西_2025年年度报告.pdf');
    expect(m.company).toBe('美迪西');
    expect(m.year).toBe(2025);
    expect(m.docType).toBe('年报');
  });

  it('无公司前缀：company 为空', () => {
    const m = parseDocMeta('2026年第一季度报告');
    expect(m.company).toBe('');
    expect(m.year).toBe(2026);
    expect(m.docType).toBe('一季报');
  });

  it('三季报', () => {
    expect(parseDocMeta('山西汾酒：2025年第三季度报告').docType).toBe('三季报');
  });

  it('招股书', () => {
    expect(parseDocMeta('首次公开发行股票并在科创板上市招股说明书').docType).toBe('招股书');
  });

  it('普通公告', () => {
    const m = parseDocMeta('关于公司控股股东增持计划的公告');
    expect(m.docType).toBe('公告');
    expect(m.company).toBe('');
  });

  it('带巨潮 <em> 高亮标签的标题被清洗', () => {
    const m = parseDocMeta('<em>紫金矿业</em>：2025年年度报告');
    expect(m.company).toBe('紫金矿业');
    expect(m.docType).toBe('年报');
  });

  it('公司段含年份则不当作公司名', () => {
    const m = parseDocMeta('2026年半年度报告（更新后）');
    expect(m.company).toBe('');
    expect(m.docType).toBe('半年报');
  });
});
