/**
 * 财报术语词典（注家系统的字词层）。
 * 内置静态词典程序匹配：零 AI 成本、毫秒响应、绝不幻觉——与「数字程序算」同一哲学。
 * 词条内容在 glossary.json，社区可通过 PR 扩充（M5 注家模板库路径）。
 */
import raw from './glossary.json';

export interface GlossaryEntry {
  term: string;
  aliases: string[];
  /** 一句话白话解释 */
  plain: string;
  /** 读财报时看这个数/概念关注什么 */
  watch: string;
  category: string;
}

export const GLOSSARY: GlossaryEntry[] = raw as GlossaryEntry[];

/** 匹配词表：词条 + 别名，按词长降序（长词优先，避免「归母净利润」被「净利润」遮蔽） */
const WORDS: Array<{ word: string; entry: GlossaryEntry }> = GLOSSARY.flatMap((entry) =>
  [entry.term, ...entry.aliases].map((word) => ({ word, entry })),
).sort((a, b) => b.word.length - a.word.length);

/**
 * span 文本命中的全部词条（去重）。
 * 长词优先：若命中的短词是另一命中长词的子串（如「净利润」之于「归母净利润」），只留长词。
 */
export function matchTerms(text: string): GlossaryEntry[] {
  const hitWords: string[] = [];
  const hitEntries = new Map<string, GlossaryEntry>();
  for (const { word, entry } of WORDS) {
    if (!text.includes(word)) continue;
    // 已有更长的命中词包含本词，跳过（长词在先）
    if (hitWords.some((w) => w.includes(word))) continue;
    hitWords.push(word);
    if (!hitEntries.has(entry.term)) hitEntries.set(entry.term, entry);
  }
  return [...hitEntries.values()];
}

/** 精确查词（工具条「解释」用）：词条或别名完全等于给定词 */
export function lookupTerm(word: string): GlossaryEntry | null {
  const w = word.trim();
  if (!w || w.length > 20) return null;
  for (const entry of GLOSSARY) {
    if (entry.term === w || entry.aliases.includes(w)) return entry;
  }
  return null;
}
