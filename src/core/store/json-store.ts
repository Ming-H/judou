/**
 * JSON 文件存储（自部署默认实现）。
 * manifest.json 存元数据，pdfs/ 存文件；PDF 按内容 hash 去重（同一份公共公告全库一份）。
 * 云版将替换为 Supabase Postgres + R2 实现（接口见 types.ts）。
 */
import { createHash, randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { parseDocMeta } from '../docMeta';
import type { CreateDocumentInput, DocumentEntry, DocumentStore } from './types';

export class JsonFileStore implements DocumentStore {
  readonly dir: string;
  private manifestPath: string;
  private pdfDir: string;
  private entries: DocumentEntry[] | null = null;
  private hashToId = new Map<string, string>();

  constructor(dir: string) {
    this.dir = dir;
    this.manifestPath = path.join(dir, 'manifest.json');
    this.pdfDir = path.join(dir, 'pdfs');
    mkdirSync(this.pdfDir, { recursive: true });
  }

  private async load(): Promise<DocumentEntry[]> {
    if (this.entries) return this.entries;
    try {
      const raw = await fs.readFile(this.manifestPath, 'utf-8');
      this.entries = JSON.parse(raw) as DocumentEntry[];
    } catch {
      this.entries = [];
    }
    // hash 索引重建（老条目无 hash 字段时按 fileName 兜底）
    for (const e of this.entries) {
      if (e.id) this.hashToId.set(e.id, e.id);
    }
    return this.entries;
  }

  private async persist(): Promise<void> {
    const tmp = `${this.manifestPath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(this.entries ?? [], null, 2), 'utf-8');
    await fs.rename(tmp, this.manifestPath);
  }

  async list(): Promise<DocumentEntry[]> {
    const all = await this.load();
    return [...all].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }

  async get(id: string): Promise<DocumentEntry | null> {
    const all = await this.load();
    return all.find((e) => e.id === id) ?? null;
  }

  async findBySourceUrl(url: string): Promise<DocumentEntry | null> {
    const all = await this.load();
    return all.find((e) => e.sourceUrl === url) ?? null;
  }

  async create(input: CreateDocumentInput): Promise<DocumentEntry> {
    const all = await this.load();
    // 内容寻址去重：hash 命中直接复用既有条目
    const hash = createHash('sha256').update(input.buffer).digest('hex');
    const existingId = this.hashToId.get(hash);
    if (existingId) {
      const existing = all.find((e) => e.id === existingId);
      if (existing) return existing;
    }
    const id = randomUUID();
    const fileName = `${id}.pdf`;
    await fs.writeFile(path.join(this.pdfDir, fileName), input.buffer);
    const meta = parseDocMeta(input.title);
    const entry: DocumentEntry = {
      id,
      title: input.title.replace(/\.pdf$/i, ''),
      fileName,
      source: input.source,
      sourceUrl: input.sourceUrl,
      size: input.buffer.length,
      addedAt: new Date().toISOString(),
      ...meta,
    };
    all.push(entry);
    this.hashToId.set(hash, id);
    await this.persist();
    return entry;
  }

  filePath(id: string): string | null {
    if (!this.entries) return null;
    const e = this.entries.find((x) => x.id === id);
    return e ? path.join(this.pdfDir, e.fileName) : null;
  }

  async remove(id: string): Promise<boolean> {
    const all = await this.load();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    const [removed] = all.splice(idx, 1);
    try {
      await fs.unlink(path.join(this.pdfDir, removed.fileName));
    } catch {
      // 文件已不存在则忽略
    }
    await this.persist();
    return true;
  }
}
