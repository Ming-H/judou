/**
 * LLM 薄网关（防锁定抽象）。双协议：
 *  - OpenAI 兼容：LLM_API_BASE 指向 .../v4 类端点 → POST {base}/chat/completions
 *  - Anthropic 兼容：LLM_API_BASE 含 /api/anthropic → POST {base}/v1/messages
 * 默认对接智谱 BigModel；环境变量：
 *   LLM_API_KEY（缺省回退 GLM_API_KEY / ANTHROPIC_AUTH_TOKEN）
 *   LLM_API_BASE（默认 https://open.bigmodel.cn/api/anthropic）
 *   LLM_MODEL（默认 glm-5.1）
 */

const DEFAULT_BASE = 'https://open.bigmodel.cn/api/anthropic';
const DEFAULT_MODEL = 'glm-5.1';

export class LLMNotConfiguredError extends Error {
  constructor() {
    super('LLM not configured');
    this.name = 'LLMNotConfiguredError';
  }
}

export interface LlmConfig {
  apiKey: string;
  apiBase: string;
  model: string;
  protocol: 'openai' | 'anthropic';
  configured: boolean;
}

export function llmConfig(): LlmConfig {
  const apiKey = process.env.LLM_API_KEY || process.env.GLM_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '';
  const apiBase = (process.env.LLM_API_BASE || DEFAULT_BASE).replace(/\/+$/, '');
  return {
    apiKey,
    apiBase,
    model: process.env.LLM_MODEL || DEFAULT_MODEL,
    protocol: apiBase.includes('/anthropic') ? 'anthropic' : 'openai',
    configured: apiKey.length > 0,
  };
}

export function llmModel(): string {
  return llmConfig().model;
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function llmChat(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
): Promise<string> {
  const { apiKey, apiBase, model, protocol, configured } = llmConfig();
  if (!configured) throw new LLMNotConfiguredError();

  if (protocol === 'anthropic') {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const rest = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));
    const res = await fetch(`${apiBase}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 1000,
        temperature: opts.temperature ?? 0.3,
        // GLM-5.3+ 默认开思考，thinking 块会先吃光 max_tokens 导致正文为空（速览空输出实测）；
        // 速览/问答/解释均为给定上下文的理解型任务，无需思考，关掉省 token 且快
        thinking: { type: 'disabled' },
        ...(system ? { system } : {}),
        messages: rest,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 120000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`LLM HTTP ${res.status} ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    return (json.content ?? [])
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text)
      .join('');
  }

  const res = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 1000,
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 120000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? '';
}
