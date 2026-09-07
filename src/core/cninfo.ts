/**
 * 巨潮资讯网（cninfo）API 客户端（服务端使用）。
 *
 * 接口红线（生产实测教训）：
 * 1. 日期参数只认 seDate（startDate/endDate 会被静默忽略），格式 YYYY-MM-DD~YYYY-MM-DD
 * 2. 返回结果仍需调用方做客户端日期复核
 * 3. 高频调用会被限流——调用方须缓存（sourceUrl/hash 去重）
 */

const CNINFO_ORIGIN = 'http://www.cninfo.com.cn';
const STATIC_ORIGIN = 'https://static.cninfo.com.cn';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** 财报四类 category（巨潮统一编码） */
export const REPORT_CATEGORY =
  'category_ndbg_szsh;category_bndbg_szsh;category_yjdbg_szsh;category_sjdbg_szsh';

export interface StockCandidate {
  code: string;
  orgId: string;
  name: string;
}

export interface CninfoAnnouncement {
  title: string;
  /** YYYY-MM-DD */
  time: string;
  url: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 判断是否值得重试：超时/连接类错误与 5xx；4xx（参数问题）不重试 */
function isRetryable(e: unknown): boolean {
  const err = e as Error;
  const msg = `${err?.name ?? ''} ${err?.message ?? ''}`.toLowerCase();
  return /timeout|aborted|fetch failed|econnreset|econnrefused|ehostunreach|enetunreach|socket hang up|http 5\d\d/.test(msg);
}

/**
 * 带重试的表单 POST。巨潮对高频访问会间歇性慢响应/掐连接（表现为
 * "The operation was aborted due to timeout"），自动重试可消化绝大多数瞬时故障。
 */
async function postForm<T>(url: string, form: Record<string, string>, retries = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(500 * attempt);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': UA,
          'X-Requested-With': 'XMLHttpRequest',
          Referer: `${CNINFO_ORIGIN}/new/commonUrl?url=disclosure/list/notice`,
        },
        body: new URLSearchParams(form).toString(),
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) return (await res.json()) as T;
      const err = new Error(`cninfo HTTP ${res.status}`);
      if (res.status < 500 || attempt === retries) throw err;
      lastErr = err;
    } catch (e) {
      if (!isRetryable(e) || attempt === retries) throw e;
      lastErr = e;
    }
  }
  throw new Error(`巨潮暂时无响应（已重试 ${retries} 次）：${(lastErr as Error)?.message ?? 'unknown'}`);
}

/** 股票检索：关键词 → 候选 {code, orgId, name} */
export async function searchStocks(keyword: string): Promise<StockCandidate[]> {
  const json = await postForm<{
    keyBoardList?: Array<{ code?: string; orgId?: string; zwjc?: string; category?: string }>;
  }>(`${CNINFO_ORIGIN}/new/information/topSearch/detailOfQuery`, {
    keyWord: keyword,
    maxSecNum: '10',
    maxListNum: '5',
  });
  const list = json?.keyBoardList ?? [];
  return list
    .filter((x) => typeof x.code === 'string' && /^\d{6}$/.test(x.code!) && typeof x.orgId === 'string' && x.orgId)
    .map((x) => ({ code: x.code!, orgId: x.orgId!, name: x.zwjc || x.code! }))
    .slice(0, 8);
}

export async function queryAnnouncements(opts: {
  code: string;
  orgId: string;
  category: string; // '' = 全部公告
  seDate: string; // YYYY-MM-DD~YYYY-MM-DD
  maxPages?: number;
}): Promise<CninfoAnnouncement[]> {
  const column = opts.code.startsWith('6') ? 'sse' : 'szse';
  const out: CninfoAnnouncement[] = [];
  const maxPages = opts.maxPages ?? 3;
  for (let page = 1; page <= maxPages; page++) {
    const json = await postForm<{
      announcements?: Array<{
        announcementTitle?: string;
        announcementTime?: number;
        adjunctUrl?: string;
      }> | null;
      totalAnnouncementCount?: number | string;
    }>(`${CNINFO_ORIGIN}/new/hisAnnouncement/query`, {
      pageNum: String(page),
      pageSize: '30',
      column,
      tabName: 'fulltext',
      plate: '',
      stock: `${opts.code},${opts.orgId}`,
      searchkey: '',
      secid: '',
      category: opts.category,
      trade: '',
      seDate: opts.seDate,
      sortName: '',
      sortType: '',
      isHLtitle: 'true',
    });
    const anns = json?.announcements ?? [];
    if (anns.length === 0) break;
    for (const a of anns) {
      const title = String(a.announcementTitle ?? '').replace(/<[^>]+>/g, '');
      const time = typeof a.announcementTime === 'number' ? new Date(a.announcementTime).toISOString().slice(0, 10) : '';
      const adjunct = String(a.adjunctUrl ?? '');
      if (!title || !adjunct || !time) continue;
      out.push({ title, time, url: `${STATIC_ORIGIN}/${adjunct}` });
    }
    const total = Number(json?.totalAnnouncementCount ?? 0);
    if (page * 30 >= total) break;
  }
  return out;
}

/** 下载公告 PDF（仅接受巨潮静态域名，防 SSRF；瞬时失败自动重试 1 次） */
export async function downloadAnnouncementPdf(url: string): Promise<Buffer> {
  if (!url.startsWith(`${STATIC_ORIGIN}/`)) throw new Error('非法下载源');
  let lastErr: unknown;
  for (let attempt = 0; attempt <= 1; attempt++) {
    if (attempt > 0) await sleep(800);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Referer: `${CNINFO_ORIGIN}/` },
        signal: AbortSignal.timeout(60000),
      });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      throw new Error(`下载失败 HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
      if (!isRetryable(e) || attempt === 1) throw e;
    }
  }
  throw (lastErr as Error) ?? new Error('下载失败');
}
