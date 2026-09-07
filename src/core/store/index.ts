import path from 'path';
import { JsonFileStore } from './json-store';

let store: JsonFileStore | null = null;
let storeDir = '';

/** 获取全局存储实例（自部署：本地 JSON；目录由 JUDOU_DATA_DIR 指定，默认 ./data） */
export function getStore(): JsonFileStore {
  const dir = process.env.JUDOU_DATA_DIR || path.join(process.cwd(), 'data');
  if (!store || storeDir !== dir) {
    store = new JsonFileStore(dir);
    storeDir = dir;
  }
  return store;
}

export type { DocumentEntry, DocumentStore, CreateDocumentInput } from './types';
