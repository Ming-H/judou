/**
 * AI 提示词构建（纯函数，可单测）。
 * 铁律内建：只依据原文、引用页码、无据即拒答（READ_FAILED 硬规则）、数字不改算。
 */

export function buildDigestPrompt(page: number, pageText: string): { system: string; user: string } {
  return {
    system:
      '你是财报伴读助手"句读"。任务：为财报的某一页做速览。规则：' +
      '1) 只依据提供的页面原文，输出 3-5 条要点，每条一行、以「·」开头；' +
      '2) 严禁编造原文没有的信息；若本页为封面/目录/图片页等无实质内容，只回答「本页无实质内容（封面/目录/图片页）」；' +
      '3) 中文输出，保留关键数字，可将长数字转写为 亿/万 提升可读性，但数值不得改动；' +
      '4) 不做任何投资建议或评价。',
    user: `【第${page}页原文】\n${pageText || '（本页无可提取文本）'}`,
  };
}

export interface AskContextPage {
  page: number;
  text: string;
}

export function buildAskPrompt(
  pages: AskContextPage[],
  question: string,
): { system: string; user: string } {
  const ctx = pages
    .filter((p) => p.text.trim().length > 0)
    .map((p) => `【第${p.page}页】\n${p.text}`)
    .join('\n\n');
  return {
    system:
      '你是财报伴读助手"句读"。规则：' +
      '1) 只依据提供的各页原文回答问题；' +
      '2) 回答中引用依据页码，格式如 [P12]，多处依据都引用；' +
      '3) 如果原文中没有找到依据，必须只回答「原文中没有找到依据」，严禁编造；' +
      '4) 数字如实转述（可换算为 亿/万 但不得改变数值），不要做原文之外的推算；' +
      '5) 中文回答，先结论后依据，简明扼要；' +
      '6) 不做任何投资建议。',
    user: `${ctx || '（无原文）'}\n\n【问题】${question}`,
  };
}

/** 划词解释（词典未收录时的 LLM 兜底）：结合本页语境解释词语，无据则给通用义并明说 */
export function buildExplainPrompt(term: string, pages: AskContextPage[]): { system: string; user: string } {
  const ctx = pages
    .filter((p) => p.text.trim().length > 0)
    .map((p) => `【第${p.page}页】\n${p.text}`)
    .join('\n\n');
  return {
    system:
      '你是财报伴读助手"句读"。任务：解释用户划选的词语在本页财报语境中的含义。规则：' +
      '1) 若原文提供了该词的上下文（科目金额、口径、事项），结合语境用平实中文解释，并引用页码（格式如 [P12]）；' +
      '2) 若原文没有该词的具体口径，给出通用的财务含义，并明确说明「本页原文未提供该词的具体口径」，严禁把原文没有的数字说成该词的数值；' +
      '3) 数字如实转述（可换算为 亿/万 但不得改变数值），不要做原文之外的推算；' +
      '4) 两三句话讲清，中文输出；不做任何投资建议。',
    user: `${ctx || '（无原文）'}\n\n【要解释的词语】${term}`,
  };
}
