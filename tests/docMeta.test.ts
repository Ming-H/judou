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

  it('无分隔符标题兜底：公司全名+年份+报告类型', () => {
    const m = parseDocMeta('山西杏花村汾酒厂股份有限公司2026年半年度报告');
    expect(m.company).toBe('山西杏花村汾酒厂股份有限公司');
    expect(m.year).toBe(2026);
    expect(m.docType).toBe('半年报');
  });

  it('无分隔符标题兜底：简称+年份+报告类型', () => {
    expect(parseDocMeta('松发股份2026年半年度报告').company).toBe('松发股份');
  });

  it('无分隔符且无公司名（纯报告名）company 仍为空', () => {
    expect(parseDocMeta('2026年半年度报告').company).toBe('');
  });

  it('公告类标题不被兜底误伤（不含报告词则不剥）', () => {
    expect(parseDocMeta('中际旭创股份有限公司关于签订重大合同的公告').company).toBe('');
  });
});
