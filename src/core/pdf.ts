/** PDF 校验工具 */

export const MAX_PDF_BYTES = 100 * 1024 * 1024; // 100MB

/** 校验 %PDF- 魔数 */
export function isPdfBuffer(buf: Buffer | Uint8Array): boolean {
  return buf.length > 4 && buf.subarray(0, 4).toString('latin1') === '%PDF';
}
