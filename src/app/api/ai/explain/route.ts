import { NextRequest, NextResponse } from 'next/server';
import { buildExplainPrompt } from '@/core/aiPrompts';
import { cacheGet, cacheSet } from '@/core/cache';
import { llmChat, LLMNotConfiguredError, llmModel } from '@/core/llm';
import { getPageTexts } from '@/core/pagetext';
import { getStore } from '@/core/store';

export const runtime = 'nodejs';

/**
 * 划词解释（词典未收录时的 LLM 兜底）：上下文 = 当前页 ±1 页原文。
 * 按「内容hash+词条+模型」缓存，同一份公告同一词条全站只解释一次。
 */
export async function POST(req: NextRequest) {
  try {
    const { docId, page: rawPage, term: rawTerm } = (await req.json()) as {
      docId?: string;
      page?: number;
      term?: string;
    };
    const page = Number(rawPage);
    const term = rawTerm?.trim().slice(0, 60) ?? '';
    if (!docId || !Number.isInteger(page) || page < 1 || !term) {
      return NextResponse.json({ error: '参数错误' }, { status: 400 });
    }
    const store = getStore();
    const entry = await store.get(docId);
    if (!entry) return NextResponse.json({ error: '文档不存在' }, { status: 404 });
    const filePath = store.filePath(entry.id);
    if (!filePath) return NextResponse.json({ error: '文件缺失' }, { status: 404 });

    const cacheKey = `explain:${entry.hash}:${term}:${llmModel()}`;
    const hit = await cacheGet(store.dir, cacheKey);
    if (hit) return NextResponse.json({ explain: hit, cached: true });

    const texts = await getPageTexts(store.dir, entry.hash, filePath);
    const contextPages = [];
    for (let p = Math.max(1, page - 1); p <= Math.min(texts.length, page + 1); p++) {
      contextPages.push({ page: p, text: texts[p - 1] ?? '' });
    }
    const { system, user } = buildExplainPrompt(term, contextPages);
    const explain = (await llmChat(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      { maxTokens: 400 },
    )).trim();

    await cacheSet(store.dir, cacheKey, explain);
    return NextResponse.json({ explain, cached: false, model: llmModel() });
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
