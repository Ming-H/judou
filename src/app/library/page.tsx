'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CninfoDialog from '@/components/CninfoDialog';
import UploadDropzone from '@/components/UploadDropzone';
import type { DocumentEntry } from '@/core/store/types';

function fmtSize(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(n / 1e3))}KB`;
}

const TYPE_BADGE: Record<string, string> = {
  年报: 'bg-amber-100 text-amber-800',
  半年报: 'bg-emerald-100 text-emerald-800',
  一季报: 'bg-sky-100 text-sky-800',
  三季报: 'bg-sky-100 text-sky-800',
  招股书: 'bg-purple-100 text-purple-800',
  公告: 'bg-zinc-200 text-zinc-700',
  其他: 'bg-zinc-100 text-zinc-600',
};

export default function LibraryPage() {
  const [docs, setDocs] = useState<DocumentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCninfo, setShowCninfo] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      const json = await res.json();
      setDocs(json.documents ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const groups = useMemo(() => {
    const map = new Map<string, DocumentEntry[]>();
    for (const d of docs) {
      const key = d.company || '未分类文档';
      const arr = map.get(key) ?? [];
      arr.push(d);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'zh'));
  }, [docs]);

  async function remove(id: string, title: string) {
    if (!confirm(`删除「${title}」？文件与衍生数据将一并移除。`)) return;
    await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    void refresh();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold">文档库</h1>
          <p className="mt-1 text-sm text-ink-700/70">
            {docs.length > 0 ? `${docs.length} 份文档 · ${groups.length} 家公司` : '导入你的第一份财报'}
          </p>
        </div>
        <button
          onClick={() => setShowCninfo(true)}
          className="rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-accent-700"
        >
          从巨潮导入财报/公告
        </button>
      </div>

      <UploadDropzone onImported={refresh} />

      <div className="mt-8 space-y-8">
        {loading && <p className="text-center text-sm text-ink-700/60">加载中…</p>}
        {!loading && docs.length === 0 && (
          <div className="rounded-xl border border-dashed border-ink-200 bg-white p-12 text-center">
            <p className="text-sm text-ink-700/70">
              还没有文档。拖入 PDF，或
              <button onClick={() => setShowCninfo(true)} className="mx-1 text-accent-600 underline">
                从巨潮搜索导入
              </button>
              你关注的公司。
            </p>
          </div>
        )}
        {groups.map(([company, list]) => (
          <section key={company}>
            <h2 className="mb-3 flex items-baseline gap-2 border-b border-ink-100 pb-2 font-serif text-lg font-bold">
              {company}
              <span className="text-xs font-normal text-ink-700/60">{list.length} 份</span>
            </h2>
            <ul className="space-y-2">
              {list.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-3 rounded-lg border border-ink-100 bg-white px-4 py-3 transition hover:border-accent-500/50"
                >
                  <div className="min-w-0 flex-1">
                    <Link href={`/read/${d.id}`} className="block truncate text-sm font-medium hover:text-accent-600">
                      {d.title}
                    </Link>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-700/60">
                      {d.docType && (
                        <span className={`rounded px-1.5 py-0.5 ${TYPE_BADGE[d.docType] ?? TYPE_BADGE['其他']}`}>
                          {d.docType}
                        </span>
                      )}
                      {d.year && <span>{d.year}</span>}
                      <span>{fmtSize(d.size)}</span>
                      <span>{d.source === 'cninfo' ? '巨潮' : '上传'}</span>
                      {/* 巨潮文档显示公告发布日期（F2.4 溯源），其余显示导入日期 */}
                      <span title={d.source === 'cninfo' ? '公告发布日期' : '导入日期'}>
                        {d.source === 'cninfo' && d.sourceTime ? d.sourceTime : d.addedAt.slice(0, 10)}
                      </span>
                    </p>
                  </div>
                  <Link
                    href={`/read/${d.id}`}
                    className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs hover:border-accent-500 hover:text-accent-600"
                  >
                    阅读
                  </Link>
                  <button
                    onClick={() => remove(d.id, d.title)}
                    className="rounded-lg px-2 py-1.5 text-xs text-ink-700/50 hover:text-red-600"
                    title="删除"
                  >
                    删除
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {showCninfo && <CninfoDialog onClose={() => setShowCninfo(false)} onImported={refresh} />}
    </div>
  );
}
