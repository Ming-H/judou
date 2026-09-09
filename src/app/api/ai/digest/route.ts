import { NextRequest, NextResponse } from 'next/server';
import { buildDigestPrompt } from '@/core/aiPrompts';
import { cacheGet, cacheSet } from '@/core/cache';
import { llmChat, LLMNotConfiguredError, llmModel } from '@/core/llm';
import { getPageTexts } from '@/core/pagetext';
import { getStore } from '@/core/store';

export const runtime = 'nodejs';

/** 本页速览：程序层抽取页面文本 → LLM 生成 3-5 条要点 → 文件缓存（换页零重复计费） */
export async function POST(req: NextRequest) {
  try {
    const { docId, page: rawPage } = (await req.json()) as { docId?: string; page?: number };
    const page = Number(rawPage);
    if (!docId || !Number.isInteger(page) || page < 1) {
      return NextResponse.json({ error: '参数错误' }, { status: 400 });
    }
    const store = getStore();
    const entry = await store.get(docId);
    if (!entry) return NextResponse.json({ error: '文档不存在' }, { status: 404 });
    const filePath = store.filePath(entry.id);
    if (!filePath) return NextResponse.json({ error: '文件缺失' }, { status: 404 });

    const cacheKey = `digest:${entry.hash}:p${page}:${llmModel()}`;
    const hit = await cacheGet(store.dir, cacheKey);
    if (hit) return NextResponse.json({ digest: hit, cached: true });

    const texts = await getPageTexts(store.dir, entry.hash, filePath);
    const pageText = texts[page - 1] ?? '';
    const { system, user } = buildDigestPrompt(page, pageText);
    const digest = (await llmChat(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      { maxTokens: 500 },
    )).trim();

    await cacheSet(store.dir, cacheKey, digest);
    return NextResponse.json({ digest, cached: false, model: llmModel() });
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
