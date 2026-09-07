import Link from 'next/link';

const LAYERS = [
  {
    verb: '读',
    title: '读得下去',
    desc: '像读书软件一样读财报原文：巨潮一键下载或拖入 PDF，目录侧栏、逐页翻阅、进度记忆。',
  },
  {
    verb: '懂',
    title: '读得明白',
    desc: '2,345,678,901.23 悬浮即得 23.46 亿；逐页速览、划词问答、多层 AI 解读，回答必附页码。',
  },
  {
    verb: '记',
    title: '看得穿',
    desc: '一标的一档：全部财报与公告融合成编年时间轴，事件带影响方向与原文引用，判断权在你。',
  },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-20 text-center">
        <p className="mb-6 inline-block rounded-full border border-ink-200 px-3 py-1 text-xs text-ink-700">
          开源 · AGPL-3.0 · 自部署数据全本地
        </p>
        <h1 className="font-serif text-4xl font-bold leading-snug tracking-wide sm:text-5xl">
          财报之不知，惑之不解。
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-700">
          句读是开源的 AI 财报伴读器——<span className="text-ink-900">给财报断句，给标的编年</span>。
          巨长数字断成明白话，散落各期的事件断成时间轴；原文恒在，AI 只做伴读。
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/library"
            className="rounded-lg bg-accent-600 px-6 py-3 font-medium text-white shadow-sm transition hover:bg-accent-700"
          >
            进入文档库，读第一份财报
          </Link>
          <a
            href="https://github.com/Ming-H/judou"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-ink-200 bg-white px-6 py-3 font-medium transition hover:border-accent-500 hover:text-accent-600"
          >
            GitHub 源码
          </a>
        </div>
      </section>

      {/* 数字句读演示 */}
      <section className="border-y border-ink-100 bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:grid-cols-2 sm:items-center">
          <div>
            <h2 className="font-serif text-2xl font-bold">数字句读</h2>
            <p className="mt-3 leading-relaxed text-ink-700">
              财报里的数字像没有标点的古文。<span className="text-ink-900">选中它</span>
              ，句读立刻断句——全部由程序换算，零延迟、零幻觉。
            </p>
          </div>
          <div className="rounded-xl border border-ink-200 bg-ink-50 p-6 font-mono text-sm leading-7">
            <p className="text-ink-700">营业收入（元）</p>
            <p className="border-b border-dashed border-accent-500/60 pb-1 text-2xl text-ink-900">
              2,345,678,901.23
            </p>
            <p className="mt-3 text-accent-600">→ 23.46 亿</p>
            <p className="text-accent-600">→ 234,567.89 万</p>
          </div>
        </div>
      </section>

      {/* 三层价值 */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {LAYERS.map((l) => (
            <div key={l.verb} className="rounded-xl border border-ink-100 bg-white p-6 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-600/10 font-serif text-lg font-bold text-accent-600">
                {l.verb}
              </div>
              <h3 className="mt-4 font-serif text-lg font-bold">{l.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">{l.desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-ink-700/70">
          当前版本 v0.1（自部署 MVP）：阅读器 + 巨潮导入 + 数字句读。逐页速览、划词问答、标的编年时间轴见路线图。
        </p>
      </section>
    </div>
  );
}
