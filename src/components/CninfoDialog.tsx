'use client';

import { useState } from 'react';
import type { DocumentEntry } from '@/core/store/types';

interface StockCandidate {
  code: string;
  orgId: string;
  name: string;
}
interface Announcement {
  title: string;
  time: string;
  url: string;
}

/** 巨潮导入弹窗：搜公司 → 选范围 → 勾选公告 → 下载入库 */
export default function CninfoDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [keyword, setKeyword] = useState('');
  const [candidates, setCandidates] = useState<StockCandidate[]>([]);
  const [picked, setPicked] = useState<StockCandidate | null>(null);
  const [scope, setScope] = useState<'reports' | 'all'>('reports');
  const [year, setYear] = useState('');
  const [anns, setAnns] = useState<Announcement[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function searchStocks() {
    if (!keyword.trim()) return;
    setBusy('搜索公司中…');
    setError('');
    try {
      const res = await fetch(`/api/cninfo/stocks?keyword=${encodeURIComponent(keyword)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setCandidates(json.candidates ?? []);
      if ((json.candidates ?? []).length === 0) setError('未找到匹配的 A 股公司');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function loadAnns(stock: StockCandidate) {
    setPicked(stock);
    setBusy('查询公告列表中…');
    setError('');
    try {
      const params = new URLSearchParams({ code: stock.code, orgId: stock.orgId, scope });
      if (/^\d{4}$/.test(year)) params.set('year', year);
      const res = await fetch(`/api/cninfo/anns?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const list: Announcement[] = json.announcements ?? [];
      setAnns(list);
      setSelected(new Set(list.map((a) => a.url)));
      if (list.length === 0) setError('该范围内没有公告（试试切换范围或年份）');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function importSelected() {
    if (!picked || selected.size === 0) return;
    setError('');
    setDone('');
    const targets = anns.filter((a) => selected.has(a.url));
    const okCount: DocumentEntry[] = [];
    for (let i = 0; i < targets.length; i++) {
      setBusy(`下载 ${i + 1}/${targets.length}：${targets[i].title.slice(0, 24)}…`);
      try {
        const res = await fetch('/api/cninfo/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targets[i].url, title: targets[i].title, time: targets[i].time }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        okCount.push(json.document);
      } catch (e) {
        setError(`「${targets[i].title.slice(0, 20)}」失败：${(e as Error).message}`);
      }
    }
    setBusy('');
    setDone(`已入库 ${okCount.length} 份`);
    if (okCount.length > 0) onImported();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
          <h2 className="font-serif font-bold">从巨潮导入</h2>
          <button onClick={onClose} className="text-ink-700 hover:text-ink-900">
            ✕
          </button>
        </div>

        <div className="border-b border-ink-100 px-5 py-3">
          <div className="flex gap-2">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchStocks()}
              placeholder="公司名或代码，如：松发股份 / 603268"
              className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none"
            />
            <button
              onClick={searchStocks}
              disabled={!keyword.trim() || !!busy}
              className="rounded-lg bg-accent-600 px-4 py-2 text-sm text-white hover:bg-accent-700 disabled:opacity-50"
            >
              搜索
            </button>
          </div>

          {candidates.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {candidates.map((c) => (
                <button
                  key={c.code}
                  onClick={() => loadAnns(c)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    picked?.code === c.code
                      ? 'border-accent-600 bg-accent-600 text-white'
                      : 'border-ink-200 hover:border-accent-500'
                  }`}
                >
                  {c.name} {c.code}
                </button>
              ))}
            </div>
          )}

          {picked && (
            <div className="mt-3 flex items-center gap-3 text-sm">
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as 'reports' | 'all')}
                className="rounded-lg border border-ink-200 px-2 py-1.5"
              >
                <option value="reports">财报正本</option>
                <option value="all">全部公告</option>
              </select>
              <input
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="年份（默认近 3 年）"
                className="w-40 rounded-lg border border-ink-200 px-2 py-1.5"
              />
              <button
                onClick={() => loadAnns(picked)}
                disabled={!!busy}
                className="rounded-lg border border-ink-200 px-3 py-1.5 hover:border-accent-500 disabled:opacity-50"
              >
                刷新列表
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {anns.length > 0 && (
            <>
              <div className="mb-2 flex items-center justify-between text-xs text-ink-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.size === anns.length}
                    onChange={(e) =>
                      setSelected(e.target.checked ? new Set(anns.map((a) => a.url)) : new Set())
                    }
                  />
                  全选（{selected.size}/{anns.length}）
                </label>
                {done && <span className="text-accent-600">{done}</span>}
              </div>
              <ul className="space-y-1">
                {anns.map((a) => (
                  <li key={a.url} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-ink-50">
                    <input
                      type="checkbox"
                      checked={selected.has(a.url)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(a.url);
                        else next.delete(a.url);
                        setSelected(next);
                      }}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm" title={a.title}>
                        {a.title}
                      </p>
                      <p className="text-xs text-ink-700/60">{a.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {!anns.length && !busy && (
            <p className="py-10 text-center text-sm text-ink-700/60">
              {picked ? '加载公告…' : '搜索公司后选择，即可拉取财报与公告'}
            </p>
          )}
        </div>

        {(busy || error) && (
          <div className="border-t border-ink-100 px-5 py-2 text-xs">
            {busy && <p className="text-accent-600">{busy}</p>}
            {error && <p className="text-red-600">{error}</p>}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-ink-100 px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-ink-200 px-4 py-2 text-sm">
            关闭
          </button>
          <button
            onClick={importSelected}
            disabled={!picked || selected.size === 0 || !!busy}
            className="rounded-lg bg-accent-600 px-4 py-2 text-sm text-white hover:bg-accent-700 disabled:opacity-50"
          >
            导入选中（{selected.size}）
          </button>
        </div>
      </div>
    </div>
  );
}
