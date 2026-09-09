import type { DocMeta } from '../docMeta';

export interface DocumentEntry extends DocMeta {
  id: string;
  title: string;
  /** 存储文件名（id.pdf） */
  fileName: string;
  source: 'upload' | 'cninfo';
  /** 巨潮公告原文链接（站内下载溯源） */
  sourceUrl?: string;
  /** 内容寻址 sha256（跨重启去重键；衍生缓存亦以此共享，见技术设计 §2） */
  hash: string;
  size: number;
  addedAt: string;
}

export interface CreateDocumentInput {
  buffer: Buffer;
  title: string;
  source: 'upload' | 'cninfo';
  sourceUrl?: string;
}

export interface DocumentStore {
  readonly dir: string;
  list(): Promise<DocumentEntry[]>;
  get(id: string): Promise<DocumentEntry | null>;
  /** 内容寻址去重：同一 PDF 返回既有条目 */
  create(input: CreateDocumentInput): Promise<DocumentEntry>;
  remove(id: string): Promise<boolean>;
  findBySourceUrl(url: string): Promise<DocumentEntry | null>;
  /** PDF 绝对路径（条目存在时） */
  filePath(id: string): string | null;
}
