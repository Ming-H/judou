/**
 * 文档元信息：从标题/文件名解析 公司 / 年份 / 文档类型。
 * 纯规则，无外部依赖。
 */

export type DocType = '年报' | '半年报' | '一季报' | '三季报' | '招股书' | '公告' | '其他';

export interface DocMeta {
  company: string;
  year?: number;
  docType: DocType;
}

/** 类型识别按顺序匹配；"半年度报告"包含"年度报告"子串，故半年报必须先判 */
const TYPE_PATTERNS: Array<[DocType, RegExp]> = [
  ['半年报', /半年度报告|中期报告|半年报/],
  ['一季报', /第一季度报告|一季度报告|一季报/],
  ['三季报', /第三季度报告|三季度报告|三季报/],
  ['年报', /年度报告|年度报告摘要|\d{4}年报/],
  ['招股书', /招股说明书|招股章程/],
];

const ANNOUNCE_RE = /公告|提示|说明|意见|通知|计划|预案|决议|摘要/;

export function parseDocMeta(rawTitle: string): DocMeta {
  let title = rawTitle.trim().replace(/\.pdf$/i, '');
  // 巨潮搜索结果可能带 <em> 高亮标签
  title = title.replace(/<[^>]+>/g, '').trim();

  // 公司名：取 ： : _ ｜ 分隔符前的短段（不含 4 位年份、不含"报告"字样）
  let company = '';
  const sep = title.match(/^([^：:_|]{2,15})[：:_|]/);
  if (sep && !/\d{4}/.test(sep[1]) && !/报告|公告/.test(sep[1])) {
    company = sep[1].trim();
  }
  // 兜底：无分隔符的标题（如"山西杏花村汾酒厂股份有限公司2026年半年度报告"），
  // 剥离"年份+报告类型"后缀后若剩余部分像公司名（含公司/集团/银行/股份字样）则采用
  if (!company) {
    const m = title.match(
      /^(.*?)(?:19[9]\d|20[0-2]\d)?\s*年?\s*(?:半年度报告|年度报告|第一季度报告|第三季度报告|季度报告|中期报告|招股说明书|招股章程)/,
    );
    const cand = m?.[1]?.trim() ?? '';
    if (cand.length >= 4 && cand.length <= 25 && /公司|集团|银行|股份/.test(cand)) {
      company = cand;
    }
  }

  const yearMatch = title.match(/(19[9]\d|20[0-2]\d)/);
  const year = yearMatch ? Number(yearMatch[0]) : undefined;

  let docType: DocType = '其他';
  for (const [type, re] of TYPE_PATTERNS) {
    if (re.test(title)) {
      docType = type;
      break;
    }
  }
  if (docType === '其他' && ANNOUNCE_RE.test(title)) docType = '公告';

  return { company, year, docType };
}
