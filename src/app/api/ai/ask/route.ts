import { NextRequest, NextResponse } from 'next/server';
import { buildAskPrompt } from '@/core/aiPrompts';
import { llmChat, LLMNotConfiguredError, llmModel } from '@/core/llm';
import { getPageTexts } from '@/core/pagetext';
import { getStore } from '@/core/store';

export const runtime = 'nodejs';

/** 划词问答：上下文 = 当前页 ±2 页原文（程序层文本），回答强制页码引用、无据即拒答 */
export async function POST(req: NextRequest) {
  try {
    const { docId, page: rawPage, question } = (await req.json()) as {
      docId?: string;
      page?: number;
      question?: string;
    };
    const page = Number(rawPage);
    if (!docId || !Number.isInteger(page) || page < 1 || !question?.trim()) {
      return NextResponse.json({ error: '参数错误' }, { status: 400 });
    }
    const store = getStore();
    const entry = await store.get(docId);
    if (!entry) return NextResponse.json({ error: '文档不存在' }, { status: 404 });
    const filePath = store.filePath(entry.id);
    if (!filePath) return NextResponse.json({ error: '文件缺失' }, { status: 404 });

    const texts = await getPageTexts(store.dir, entry.hash, filePath);
    const contextPages = [];
    for (let p = Math.max(1, page - 2); p <= Math.min(texts.length, page + 2); p++) {
      contextPages.push({ page: p, text: texts[p - 1] ?? '' });
    }
    const { system, user } = buildAskPrompt(contextPages, question.trim());
    const answer = (await llmChat(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      { maxTokens: 900 },
    )).trim();

    return NextResponse.json({ answer, contextPages: contextPages.map((p) => p.page), model: llmModel() });
  } catch (e) {
    if (e instanceof LLMNotConfiguredError) {
      return NextResponse.json(
        { error: 'LLM 未配置：请在 .env.local 设置 LLM_API_KEY（或 GLM_API_KEY），重启后生效' },
        { status: 412 },
      );
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
