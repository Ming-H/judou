/**
 * 数字句读：巨长数字 → 万/亿可读形式。
 * 全部由程序完成（产品铁律 3：数字程序算，AI 只说人话）。
 */

export interface NumberReading {
  /** 原始数字串，如 "2,345,678,901.23" */
  raw: string;
  /** 数值（元） */
  yuan: number;
  /** 亿表示，如 "23.46 亿"；不足 1 亿为 undefined */
  yi?: string;
  /** 万表示，如 "234,567.89 万"；不足 1 万为 undefined */
  wan?: string;
}

/** 巨长数字：千分位分组 或 ≥6 位连续数字（含小数部分） */
const LARGE_NUM_RE = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{6,}(?:\.\d+)?/g;

/** 从文本中提取全部巨长数字串 */
export function extractLargeNumbers(text: string): string[] {
  return text.match(LARGE_NUM_RE) ?? [];
}

/** "2,345,678,901.23" → 2345678901.23 */
export function parseNumberString(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

/** 千分位分组，decimals 位小数 */
export function groupThousands(n: number, decimals = 2): string {
  const fixed = n.toFixed(decimals);
  const [int, dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec ? `${grouped}.${dec}` : grouped;
}

/** 换算阈值：≥1 亿 → 亿 + 万；≥1 万 → 万；更小不换算（返回 null） */
export function readNumber(raw: string): NumberReading | null {
  const yuan = parseNumberString(raw);
  if (!Number.isFinite(yuan)) return null;
  const reading: NumberReading = { raw, yuan };
  if (yuan >= 1e8) {
    reading.yi = `${(yuan / 1e8).toFixed(2)} 亿`;
    reading.wan = `${fmtWan(yuan / 1e4)} 万`;
  } else if (yuan >= 1e4) {
    reading.wan = `${fmtWan(yuan / 1e4)} 万`;
  } else {
    return null;
  }
  return reading;
}

/** 万格式化：整数不带小数位，非整数保留 2 位 */
function fmtWan(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return groupThousands(rounded, Number.isInteger(rounded) ? 0 : 2);
}

/** 划词卡片：一段选中文本里全部可换算的数字 */
export function readSelection(text: string): NumberReading[] {
  const out: NumberReading[] = [];
  for (const raw of extractLargeNumbers(text)) {
    const reading = readNumber(raw);
    if (reading) out.push(reading);
  }
  return out;
}
