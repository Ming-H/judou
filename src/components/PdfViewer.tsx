'use client';

/**
 * PDF 阅读器：canvas 原版面渲染 + pdfjs 文本层（承担选中与语义叠加）。
 * 数字句读：划选或点击长数字 → 悬浮换算卡（纯程序换算）。
 */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readNumber, readSelection, type NumberReading } from '@/core/numberReadability';
import type { DocumentEntry } from '@/core/store/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type PdfjsLib = any;

let pdfjsPromise: Promise<PdfjsLib> | null = null;
function loadPdfjs(): Promise<PdfjsLib> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((lib: PdfjsLib) => {
      lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      return lib;
    });
  }
  return pdfjsPromise;
}

interface OutlineItem {
  title: string;
  page: number;
  depth: number;
}

/** 财报标准章节速查（PDF 无书签时的兜底目录；页码为常见结构的大致位置） */
const STANDARD_SECTIONS: Array<[string, number]> = [
  ['第一节 重要提示、目录', 0.02],
  ['第二节 公司简介和主要财务指标', 0.04],
  ['第三节 管理层讨论与分析', 0.08],
  ['第四节 公司治理', 0.35],
  ['第五节 环境和社会责任', 0.42],
  ['第六节 重要事项', 0.45],
  ['第七节 股份变动及股东情况', 0.55],
  ['第八节 财务报告', 0.62],
  ['第九节 备查文件目录', 0.98],
];

type HighlightMode = 'line' | 'color' | 'off';

export default function PdfViewer({ doc }: { doc: DocumentEntry }) {
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [outline, setOutline] = useState<OutlineItem[] | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mode, setMode] = useState<HighlightMode>('line');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [popover, setPopover] = useState<{ x: number; y: number; readings: NumberReading[] } | null>(null);

  /* AI 解读面板 */
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTab, setAiTab] = useState<'digest' | 'ask'>('digest');
  const [digest, setDigest] = useState<{ text: string; loading: boolean; error?: string }>({
    text: '',
    loading: false,
  });
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([]);
  const [asking, setAsking] = useState(false);
  const [lastSelection, setLastSelection] = useState('');

  const pdfRef = useRef<PdfjsLib>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const hlSpansRef = useRef<HTMLSpanElement[]>([]);
  /** 最近一次渲染的适配基准（供"整页"按钮换算） */
  const fitRef = useRef<{ fitScale: number; baseH: number; baseW: number }>({ fitScale: 1, baseH: 0, baseW: 0 });

  const fileUrl = useMemo(() => `/api/documents/${doc.id}/file`, [doc.id]);

  /* 加载 PDF + 书签 + 恢复阅读进度 */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const pdf = await pdfjs.getDocument({ url: fileUrl }).promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        const saved = Number(localStorage.getItem(`judou:progress:${doc.id}`));
        if (saved >= 1 && saved <= pdf.numPages) setPageNum(saved);

        const rawOutline = await pdf.getOutline().catch(() => null);
        if (rawOutline?.length) {
          const flat: OutlineItem[] = [];
          const walk = async (items: any[], depth: number) => {
            for (const item of items) {
              if (!item) continue;
              let page = 0;
              try {
                const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest;
                if (Array.isArray(dest) && dest[0]) page = (await pdf.getPageIndex(dest[0])) + 1;
              } catch {
                /* 无效书签跳过 */
              }
              if (item.title) flat.push({ title: item.title, page, depth });
              if (item.items?.length) await walk(item.items, depth + 1);
            }
          };
          await walk(rawOutline, 0);
          if (!cancelled) setOutline(flat.filter((i) => i.page > 0));
        } else {
          // 无书签：置空以触发"财报标准章节速查"兜底目录（否则侧栏空白）
          if (!cancelled) setOutline([]);
        }
        if (!cancelled) setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(`文档加载失败：${(e as Error).message}`);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUrl, doc.id]);

  /* 渲染当前页：canvas + 文本层对齐 + 数字高亮 */
  const renderPage = useCallback(async () => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    const textLayerDiv = textLayerRef.current;
    const container = containerRef.current;
    const scroll = scrollRef.current;
    if (!pdf || !canvas || !textLayerDiv || !container || !scroll) return;

    const page = await pdf.getPage(pageNum);
    const base = page.getViewport({ scale: 1 });
    // 适配基准 = 可滚动视口宽度（而不是页面自身宽度），窗口/侧栏变化即自适应
    const avail = Math.max(200, scroll.clientWidth - 24);
    const fitScale = avail / base.width;
    fitRef.current = { fitScale, baseH: base.height, baseW: base.width };
    const viewport = page.getViewport({ scale: fitScale * zoom });

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    renderTaskRef.current?.cancel();
    const task = page.render({
      canvasContext: canvas.getContext('2d'),
      viewport,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
    });
    renderTaskRef.current = task;
    try {
      await task.promise;
    } catch {
      return; // 被后续渲染取消
    }

    textLayerDiv.innerHTML = '';
    textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
    textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;
    const pdfjs = await loadPdfjs();
    const textLayer = new pdfjs.TextLayer({
      textContentSource: page.streamTextContent(),
      container: textLayerDiv,
      viewport,
    });
    await textLayer.render();

    // 数字句读叠加：长数字（千分位组或 ≥6 位）加高亮类
    const spans: HTMLSpanElement[] = [];
    textLayerDiv.querySelectorAll('span').forEach((el) => {
      const span = el as HTMLSpanElement;
      const text = span.textContent ?? '';
      if (/\d{1,3}(,\d{3})+|\d{6,}/.test(text)) {
        span.classList.add('hl-num');
        spans.push(span);
      }
    });
    hlSpansRef.current = spans;
    container.className = container.className.replace(/\s*mode-\w+/g, '');
    container.className += ` mode-${mode}`;
    // 依赖含 loading：PDF 异步加载完成（loading→false）后触发首屏渲染。
    // 否则首次打开（无历史进度、pageNum 不变）永远不渲染，canvas 停在默认 300×150。
  }, [pageNum, zoom, mode, loading]);

  useEffect(() => {
    // 加载中不渲染、不写进度——mount 时同步写入会把已存的阅读进度覆盖为 1，
    // 而进度恢复要等 PDF 加载完成后才读取（两条路径存在时序差）。
    if (loading) return;
    void renderPage();
    localStorage.setItem(`judou:progress:${doc.id}`, String(pageNum));
  }, [renderPage, pageNum, doc.id, loading]);

  /* 容器尺寸变化（窗口缩放、开合目录侧栏/AI 面板）→ 自适应重渲染 */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => void renderPage());
    ro.observe(el);
    return () => ro.disconnect();
  }, [renderPage]);

  /** 整页显示：按视口高度换算缩放倍率 */
  function fitPage() {
    const scroll = scrollRef.current;
    const { fitScale, baseH } = fitRef.current;
    if (!scroll || !baseH) return;
    const target = (scroll.clientHeight - 24) / baseH;
    setZoom(Math.max(0.3, Math.min(3, Math.round((target / fitScale) * 100) / 100)));
  }

  /* 键盘翻页 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setPageNum((p) => Math.max(1, p - 1));
      if (e.key === 'ArrowRight' || e.key === 'PageDown') setPageNum((p) => Math.min(numPages, p + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [numPages]);

  /* 高亮模式偏好：恢复须先于持久化声明（挂载时同批副作用按声明顺序执行，先读后写） */
  useEffect(() => {
    const saved = localStorage.getItem('judou:hlmode');
    if (saved === 'line' || saved === 'color' || saved === 'off') setMode(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem('judou:hlmode', mode);
  }, [mode]);

  /* 划词 → 数字换算卡 */
  function handleSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setPopover(null);
      return;
    }
    const text = sel.toString();
    const readings = readSelection(text);
    if (readings.length === 0) {
      setPopover(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setPopover({ x: rect.left + rect.width / 2, y: rect.top, readings });
    setLastSelection(text.trim().slice(0, 400));
  }

  /* 点击高亮数字 → 换算卡 */
  function handleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.classList?.contains('hl-num')) {
      const reading = readNumber(target.textContent ?? '');
      if (reading) {
        const rect = target.getBoundingClientRect();
        setPopover({ x: rect.left + rect.width / 2, y: rect.top, readings: [reading] });
        return;
      }
    }
    setPopover(null);
  }

  const toc = outline ?? [];
  const usingStandard = outline !== null && outline.length === 0;

  /* 本页速览：AI 面板打开且在速览页签时，随翻页自动生成（服务端有缓存，翻回零成本） */
  useEffect(() => {
    if (!aiOpen || aiTab !== 'digest' || loading || error) return;
    let cancelled = false;
    setDigest({ text: '', loading: true });
    (async () => {
      try {
        const res = await fetch('/api/ai/digest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docId: doc.id, page: pageNum }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '速览生成失败');
        if (!cancelled) setDigest({ text: json.digest, loading: false });
      } catch (e) {
        if (!cancelled) setDigest({ text: '', loading: false, error: (e as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [aiOpen, aiTab, pageNum, doc.id, loading, error]);

  /* 划词问答 */
  async function ask() {
    const q = question.trim();
    if (!q || asking) return;
    setQuestion('');
    setChat((c) => [...c, { role: 'user', text: q }]);
    setAsking(true);
    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: doc.id, page: pageNum, question: q }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '问答失败');
      setChat((c) => [...c, { role: 'ai', text: json.answer }]);
    } catch (e) {
      setChat((c) => [...c, { role: 'ai', text: `出错了：${(e as Error).message}` }]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 bg-white px-3 py-2 text-sm">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="rounded border border-ink-200 px-2 py-1 text-xs hover:border-accent-500"
          title="目录"
        >
          ☰ 目录
        </button>
        <div className="min-w-0 flex-1 truncate px-2">
          <span className="font-medium">{doc.title}</span>
          {doc.company && <span className="ml-2 text-xs text-ink-700/60">{doc.company}</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            disabled={pageNum <= 1}
            className="rounded border border-ink-200 px-2 py-1 disabled:opacity-40"
          >
            ‹
          </button>
          <input
            value={pageNum}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/\D/g, ''));
              if (n >= 1 && n <= numPages) setPageNum(n);
            }}
            className="w-12 rounded border border-ink-200 px-1 py-1 text-center text-xs"
          />
          <span className="text-xs text-ink-700/70">/ {numPages || '…'}</span>
          <button
            onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
            disabled={pageNum >= numPages}
            className="rounded border border-ink-200 px-2 py-1 disabled:opacity-40"
          >
            ›
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
            className="rounded border border-ink-200 px-2 py-1 text-xs"
            title="缩小"
          >
            −
          </button>
          <span className="w-12 text-center text-xs" title={zoom === 1 ? '适应宽度' : '缩放倍率'}>
            {zoom === 1 ? '适宽' : `${Math.round(zoom * 100)}%`}
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.1) * 10) / 10))}
            className="rounded border border-ink-200 px-2 py-1 text-xs"
            title="放大"
          >
            +
          </button>
          <button
            onClick={() => setZoom(1)}
            className={`rounded border px-2 py-1 text-xs ${
              zoom === 1 ? 'border-accent-500 text-accent-600' : 'border-ink-200 hover:border-accent-500'
            }`}
            title="页面宽度铺满可用区域（随窗口自适应）"
          >
            适宽
          </button>
          <button
            onClick={fitPage}
            className="rounded border border-ink-200 px-2 py-1 text-xs hover:border-accent-500"
            title="整页显示（按视口高度适配）"
          >
            整页
          </button>
        </div>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as HighlightMode)}
          className="rounded border border-ink-200 px-1 py-1 text-xs"
          title="数字高亮模式"
        >
          <option value="line">数字·线条</option>
          <option value="color">数字·颜色</option>
          <option value="off">数字·关闭</option>
        </select>
        <button
          onClick={() => setAiOpen(!aiOpen)}
          className={`rounded border px-2 py-1 text-xs font-medium ${
            aiOpen ? 'border-accent-600 bg-accent-600 text-white' : 'border-accent-500/60 text-accent-600 hover:bg-accent-600/10'
          }`}
          title="AI 解读：本页速览 + 划词问答"
        >
          ✦ AI 解读
        </button>
        <Link href="/library" className="rounded border border-ink-200 px-2 py-1 text-xs hover:border-accent-500">
          返回
        </Link>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 目录侧栏 */}
        {sidebarOpen && (
          <aside className="w-60 shrink-0 overflow-y-auto border-r border-ink-100 bg-white p-3 text-sm">
            <p className="mb-2 text-xs font-medium text-ink-700/70">
              {usingStandard ? '目录（PDF 无书签，标准章节速查）' : '目录'}
            </p>
            <ul className="space-y-0.5">
              {toc.map((item, i) => (
                <li key={i} style={{ paddingLeft: item.depth * 12 }}>
                  <button
                    onClick={() => setPageNum(item.page)}
                    className="block w-full truncate rounded px-1.5 py-1 text-left text-xs hover:bg-ink-50 hover:text-accent-600"
                    title={item.title}
                  >
                    {item.title}
                    <span className="ml-1 text-ink-700/50">{item.page}</span>
                  </button>
                </li>
              ))}
              {usingStandard &&
                STANDARD_SECTIONS.map(([title, ratio]) => (
                  <li key={title}>
                    <button
                      onClick={() => setPageNum(Math.max(1, Math.round(numPages * ratio)))}
                      className="block w-full rounded px-1.5 py-1 text-left text-xs hover:bg-ink-50 hover:text-accent-600"
                    >
                      {title}
                      <span className="ml-1 text-ink-700/50">≈{Math.max(1, Math.round(numPages * ratio))}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </aside>
        )}

        {/* 正文 */}
        <div
          ref={scrollRef}
          className="relative flex-1 overflow-auto bg-ink-100/60 p-2"
          onScroll={() => setPopover(null)}
        >
          {loading && (
            <div className="flex h-full items-center justify-center text-sm text-ink-700/70">
              正在打开 {doc.title}…
            </div>
          )}
          {error && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-red-600">
              {error}
              <Link href="/library" className="text-accent-600 underline">
                返回文档库
              </Link>
            </div>
          )}
          <div className="mx-auto w-fit" onMouseUp={handleSelection} onClick={handleClick}>
            <div ref={containerRef} className="relative shadow-md">
              <canvas ref={canvasRef} className="block bg-white" />
              <div ref={textLayerRef} className="textLayer" />
            </div>
          </div>
        </div>

        {/* AI 解读侧栏 */}
        {aiOpen && (
          <aside className="flex w-80 shrink-0 flex-col border-l border-ink-100 bg-white">
            <div className="flex border-b border-ink-100 text-sm">
              <button
                onClick={() => setAiTab('digest')}
                className={`flex-1 py-2 ${
                  aiTab === 'digest'
                    ? 'border-b-2 border-accent-600 font-medium text-accent-600'
                    : 'text-ink-700 hover:text-accent-600'
                }`}
              >
                本页速览
              </button>
              <button
                onClick={() => setAiTab('ask')}
                className={`flex-1 py-2 ${
                  aiTab === 'ask'
                    ? 'border-b-2 border-accent-600 font-medium text-accent-600'
                    : 'text-ink-700 hover:text-accent-600'
                }`}
              >
                划词问答
              </button>
            </div>
            <div className="flex items-center justify-between border-b border-ink-100 px-3 py-1.5 text-[10px] text-ink-700/60">
              <span>上下文：第 {Math.max(1, pageNum - 2)}-{Math.min(numPages, pageNum + 2)} 页原文</span>
              <span className="rounded bg-ink-100 px-1.5 py-0.5">AI 生成 · 以原文为准</span>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 text-sm">
              {aiTab === 'digest' ? (
                digest.loading ? (
                  <p className="text-ink-700/70">⏳ 正在读取第 {pageNum} 页并生成速览…</p>
                ) : digest.error ? (
                  <div className="rounded-lg bg-red-50 p-3 text-xs leading-relaxed text-red-700">
                    {digest.error.includes('LLM 未配置') ? (
                      <>
                        <p className="font-medium">LLM 未配置</p>
                        <p className="mt-1">
                          在项目根目录创建 <code>.env.local</code>，写入：
                          <br />
                          <code>LLM_API_KEY=你的key</code>
                          <br />
                          （支持智谱 GLM / 任何 OpenAI 兼容端点，可用 LLM_API_BASE、LLM_MODEL 覆盖），重启后生效。
                        </p>
                      </>
                    ) : (
                      digest.error
                    )}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed">{digest.text}</p>
                )
              ) : (
                <div className="space-y-3">
                  {chat.length === 0 && (
                    <p className="text-xs leading-relaxed text-ink-700/60">
                      问当前页±2 页内的内容，回答会标注依据页码（如 [P12]）；原文没有依据时，AI
                      会直接回答「原文中没有找到依据」而不是编造。
                    </p>
                  )}
                  {chat.map((m, i) => (
                    <div
                      key={i}
                      className={m.role === 'user' ? 'rounded-lg bg-accent-600/10 px-3 py-2' : 'px-1 py-1'}
                    >
                      {m.role === 'ai' && (
                        <span className="mr-1 rounded bg-ink-100 px-1 text-[10px] text-ink-700/70">AI</span>
                      )}
                      <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                    </div>
                  ))}
                  {asking && <p className="text-xs text-ink-700/60">⏳ 思考中…</p>}
                </div>
              )}
            </div>

            {aiTab === 'ask' && (
              <div className="border-t border-ink-100 p-2">
                {lastSelection && (
                  <button
                    onClick={() => setQuestion((q) => (q ? `${q}\n` : '') + `「${lastSelection}」`)}
                    className="mb-1 block w-full truncate rounded bg-ink-50 px-2 py-1 text-left text-[10px] text-accent-600 hover:bg-ink-100"
                    title={lastSelection}
                  >
                    ＋ 引用划选文本：{lastSelection.slice(0, 40)}
                  </button>
                )}
                <div className="flex gap-2">
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ask();
                    }}
                    rows={2}
                    placeholder={`问第 ${pageNum} 页的内容，如：合同负债为什么增加？`}
                    className="flex-1 resize-none rounded-lg border border-ink-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                  />
                  <button
                    onClick={ask}
                    disabled={asking || !question.trim()}
                    className="self-end rounded-lg bg-accent-600 px-3 py-1.5 text-xs text-white hover:bg-accent-700 disabled:opacity-50"
                  >
                    发送
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* 数字句读悬浮卡 */}
      {popover && (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-accent-500/40 bg-white px-4 py-3 shadow-xl"
          style={{ left: popover.x, top: popover.y - 8 }}
          onMouseLeave={() => setPopover(null)}
        >
          <p className="mb-1 text-[10px] tracking-widest text-ink-700/60">数字句读</p>
          {popover.readings.map((r, i) => (
            <div key={i} className="font-mono text-sm">
              <p className="text-xs text-ink-700/70">{r.raw}</p>
              {r.yi && <p className="font-medium text-accent-600">{r.yi}</p>}
              {r.wan && r.yi && <p className="text-ink-900">{r.wan}</p>}
              {r.wan && !r.yi && <p className="font-medium text-accent-600">{r.wan}</p>}
            </div>
          ))}
          <p className="mt-1 text-[10px] text-ink-700/50">程序换算 · 非AI生成</p>
        </div>
      )}
    </div>
  );
}
