/** 小型文件缓存（AI 产物按 key 落盘，避免重复计费） */
import { promises as fs } from 'fs';
import path from 'path';

function cachePath(dataDir: string, key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9:_-]/g, '_');
  return path.join(dataDir, 'ai-cache', `${safe}.txt`);
}

export async function cacheGet(dataDir: string, key: string): Promise<string | null> {
  try {
    return await fs.readFile(cachePath(dataDir, key), 'utf-8');
  } catch {
    return null;
  }
}

export async function cacheSet(dataDir: string, key: string, value: string): Promise<void> {
  const file = cachePath(dataDir, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, value, 'utf-8');
}
