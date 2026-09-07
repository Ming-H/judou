'use client';

import { useRef, useState } from 'react';

export default function UploadDropzone({ onImported }: { onImported: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true);
    setMessage(`正在导入 ${list.length} 个文件…`);
    try {
      const form = new FormData();
      for (const f of list) form.append('file', f);
      const res = await fetch('/api/documents', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '导入失败');
      const rejected = json.rejected?.length ? `（已拒绝：${json.rejected.join('、')}）` : '';
      setMessage(`已导入 ${json.documents.length} 份${rejected}`);
      onImported();
    } catch (e) {
      setMessage(`导入失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void upload(e.dataTransfer.files);
        }}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
          dragging ? 'border-accent-500 bg-accent-600/5' : 'border-ink-200 bg-white hover:border-accent-500/60'
        }`}
      >
        <p className="text-sm text-ink-700">
          {busy ? '⏳ 处理中…' : '拖拽财报/公告 PDF 到这里，或点击选择文件（支持多选）'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {message && <p className="mt-2 text-xs text-ink-700">{message}</p>}
    </div>
  );
}
