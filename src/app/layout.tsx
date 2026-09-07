import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '句读 · 开源 AI 财报伴读器',
    template: '%s · 句读',
  },
  description:
    '句读（judou）——给财报断句，给标的编年。开源的 AI 财报伴读器：巨长数字换算成亿、逐页速览、划词问答、标的编年时间轴。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen flex-col">
        <header className="border-b border-ink-100 bg-white/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="font-serif text-xl font-bold tracking-wide">句读</span>
              <span className="hidden text-xs text-ink-700/60 sm:inline">jù dòu · 财报伴读</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/library" className="text-ink-700 hover:text-accent-600">
                文档库
              </Link>
              <a
                href="https://github.com/Ming-H/judou"
                target="_blank"
                rel="noreferrer"
                className="text-ink-700 hover:text-accent-600"
              >
                GitHub
              </a>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-ink-100 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-4 text-xs leading-relaxed text-ink-700/70">
            <p>
              本工具仅整理公开披露信息，不构成任何投资建议；数据以巨潮资讯网原文为准。AI 生成内容均以「AI」标识。
            </p>
            <p className="mt-1">句读 judou · AGPL-3.0 开源 · 财报之不知，惑之不解。</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
