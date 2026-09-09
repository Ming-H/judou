import { mkdtemp, rm } from 'fs/promises';
import { access, mkdir, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { JsonFileStore } from '../src/core/store/json-store';

const dirs: string[] = [];

async function newStore(): Promise<JsonFileStore> {
  const dir = await mkdtemp(path.join(tmpdir(), 'judou-test-'));
  dirs.push(dir);
  return new JsonFileStore(dir);
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

const FAKE_PDF = Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\nfake body');

describe('JSON 文件存储', () => {
  it('create → list → get 闭环，元信息从标题解析', async () => {
    const store = await newStore();
    const entry = await store.create({ buffer: FAKE_PDF, title: '松发股份：2026年半年度报告.pdf', source: 'upload' });
    expect(entry.company).toBe('松发股份');
    expect(entry.docType).toBe('半年报');
    expect(entry.year).toBe(2026);
    expect((await store.list()).length).toBe(1);
    expect((await store.get(entry.id))?.id).toBe(entry.id);
  });

  it('AC2.3 内容寻址去重：同一 PDF 二次导入返回既有条目', async () => {
    const store = await newStore();
    const a = await store.create({ buffer: FAKE_PDF, title: 'A.pdf', source: 'upload' });
    const b = await store.create({ buffer: FAKE_PDF, title: 'B.pdf', source: 'cninfo', sourceUrl: 'https://x' });
    expect(b.id).toBe(a.id);
    expect((await store.list()).length).toBe(1);
  });

  it('AC2.3 跨重启去重：hash 持久化，新实例同 buffer 复用既有条目', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'judou-test-'));
    dirs.push(dir);
    const s1 = new JsonFileStore(dir);
    const a = await s1.create({ buffer: FAKE_PDF, title: 'A.pdf', source: 'upload' });
    expect(a.hash).toBeTruthy(); // hash 已随条目持久化
    const s2 = new JsonFileStore(dir); // 模拟进程重启
    const b = await s2.create({ buffer: FAKE_PDF, title: 'B.pdf', source: 'upload' });
    expect(b.id).toBe(a.id);
    expect((await s2.list()).length).toBe(1);
  });

  it('老条目（hash 未持久化时代）加载时按文件内容回补 hash 并落盘', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'judou-test-'));
    dirs.push(dir);
    const s1 = new JsonFileStore(dir);
    const a = await s1.create({ buffer: FAKE_PDF, title: 'A.pdf', source: 'upload' });
    // 模拟旧版 manifest：抹掉 hash 字段
    const manifestPath = path.join(dir, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
    delete manifest[0].hash;
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    const s2 = new JsonFileStore(dir); // 加载时回补
    const b = await s2.create({ buffer: FAKE_PDF, title: 'again.pdf', source: 'upload' });
    expect(b.id).toBe(a.id); // 回补后去重命中
    const persisted = JSON.parse(await readFile(manifestPath, 'utf-8'));
    expect(persisted[0].hash).toBe(a.hash); // 回补结果已落盘
  });

  it('findBySourceUrl 命中', async () => {
    const store = await newStore();
    const url = 'https://static.cninfo.com.cn/finalpage/2026/1.PDF';
    const entry = await store.create({ buffer: FAKE_PDF, title: '某公告', source: 'cninfo', sourceUrl: url });
    expect((await store.findBySourceUrl(url))?.id).toBe(entry.id);
  });

  it('F2.4 公告日期随条目入库（sourceTime）', async () => {
    const store = await newStore();
    const entry = await store.create({
      buffer: FAKE_PDF,
      title: '松发股份：关于签订重大合同的公告',
      source: 'cninfo',
      sourceUrl: 'https://static.cninfo.com.cn/finalpage/2026/9/1.PDF',
      sourceTime: '2026-09-01',
    });
    expect(entry.sourceTime).toBe('2026-09-01');
    expect((await store.get(entry.id))?.sourceTime).toBe('2026-09-01');
  });

  it('remove 删除条目与文件', async () => {
    const store = await newStore();
    const entry = await store.create({ buffer: FAKE_PDF, title: 'x.pdf', source: 'upload' });
    expect(await store.remove(entry.id)).toBe(true);
    expect(await store.get(entry.id)).toBeNull();
    expect((await store.list()).length).toBe(0);
    expect(await store.remove(entry.id)).toBe(false);
  });

  it('AC2.4 remove 同时清理 pagetext 与 ai-cache 衍生数据（含旧版 docId 键名）', async () => {
    const store = await newStore();
    const entry = await store.create({ buffer: FAKE_PDF, title: 'x.pdf', source: 'upload' });
    // 模拟衍生产物：新版按 hash 命名 + 旧版按 docId 命名
    await mkdir(path.join(store.dir, 'pagetext'), { recursive: true });
    await mkdir(path.join(store.dir, 'ai-cache'), { recursive: true });
    const files = [
      path.join(store.dir, 'pagetext', `${entry.hash}.json`),
      path.join(store.dir, 'pagetext', `${entry.id}.json`),
      path.join(store.dir, 'ai-cache', `digest:${entry.hash}:p1:glm-5_1.txt`),
      path.join(store.dir, 'ai-cache', `digest:${entry.id}:p2:glm-5_1.txt`),
    ];
    for (const f of files) await writeFile(f, 'x', 'utf-8');

    await store.remove(entry.id);
    for (const f of files) {
      await expect(access(f)).rejects.toThrow(); // 全部清理
    }
  });

  it('AC2.4 衍生数据共享保护：仍有条目引用同一 hash 时不删缓存', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'judou-test-'));
    dirs.push(dir);
    const s1 = new JsonFileStore(dir);
    const a = await s1.create({ buffer: FAKE_PDF, title: 'A.pdf', source: 'upload' });
    const other = Buffer.from('%PDF-1.4 another distinct body');
    const b = await s1.create({ buffer: other, title: 'B.pdf', source: 'upload' });
    // 手工构造同 hash 共享场景：把 b 的 hash 索引指回 a 的内容（共享衍生产物）
    const manifestPath = path.join(dir, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
    const entryB = manifest.find((e: { id: string }) => e.id === b.id);
    entryB.hash = a.hash;
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    const s2 = new JsonFileStore(dir);
    const cacheFile = path.join(dir, 'pagetext', `${a.hash}.json`);
    await mkdir(path.join(dir, 'pagetext'), { recursive: true });
    await writeFile(cacheFile, 'x', 'utf-8');

    await s2.remove(a.id); // 删除 a，但 b 仍引用同一 hash
    await expect(access(cacheFile)).resolves.toBeUndefined(); // 共享缓存保留
  });

  it('重启（新实例同一目录）后数据仍在', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'judou-test-'));
    dirs.push(dir);
    const s1 = new JsonFileStore(dir);
    const entry = await s1.create({ buffer: FAKE_PDF, title: '松发股份：2025年年度报告', source: 'upload' });
    const s2 = new JsonFileStore(dir);
    expect((await s2.list()).map((e) => e.id)).toEqual([entry.id]);
    expect(s2.filePath(entry.id)).toBeTruthy();
  });
});
