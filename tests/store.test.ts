import { mkdtemp, rm } from 'fs/promises';
import { readFile, writeFile } from 'fs/promises';
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

  it('remove 删除条目与文件', async () => {
    const store = await newStore();
    const entry = await store.create({ buffer: FAKE_PDF, title: 'x.pdf', source: 'upload' });
    expect(await store.remove(entry.id)).toBe(true);
    expect(await store.get(entry.id)).toBeNull();
    expect((await store.list()).length).toBe(0);
    expect(await store.remove(entry.id)).toBe(false);
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
