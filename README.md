# 句读 judou

> **财报之不知，惑之不解。**
> 开源的 AI 财报伴读器 + 标的编年史 —— 给财报断句，给标的编年。

**Judou** (jù dòu) is the ancient art of punctuating unpunctuated classical Chinese text. Financial reports are the modern equivalent: enormous numbers, dense tables, events scattered across dozens of filings. Judou punctuates them for you — in Chinese, for A-share disclosures from cninfo.

```
2,345,678,901.23 元   ──句读──▶   23.46 亿 · 234,567.89 万
```

## v0.1 已实现（自部署 MVP）

- **读**：PDF 原版面阅读器（pdf.js canvas + 文本层）——目录侧栏/书签、翻页缩放、键盘导航、阅读进度记忆
- **数字句读**：划选或点击任意长数字，悬浮卡即刻换算成亿/万（纯程序换算，零 AI、零幻觉）
- **巨潮导入**：站内搜索公司（真实调用巨潮接口），一键拉取财报正本/全部公告入库，sourceUrl 溯源去重
- **手动导入**：拖拽任意财报/公告 PDF，按公司自动归组的文档库
- **AI 解读（阅读器右上「✦ AI 解读」）**：
  - **本页速览**：随翻页自动生成 3-5 条要点（文件缓存，翻回零成本）
  - **划词问答**：基于当前页 ±2 页原文回答，强制页码引用（如 [P6]）；原文无据时只答「原文中没有找到依据」，绝不编造
  - 所有输出挂「AI 生成 · 以原文为准」标识
- 内容寻址去重：同一份公共公告全库只存一份

### AI 配置（可选，不配则 AI 面板给出引导）

```bash
cp .env.example .env.local   # 填入 LLM_API_KEY，支持智谱 GLM（默认）或任何 OpenAI 兼容端点
```

`LLM_API_KEY` / `LLM_API_BASE` / `LLM_MODEL` 三变量即接即用；数字句读等核心功能完全不需要 AI。

## 快速开始

```bash
npm install
npm run dev        # http://localhost:3000
```

文档存储在 `./data/`（可用环境变量 `JUDOU_DATA_DIR` 改路径）。零云依赖、零 API key。

### Docker 自部署

```bash
docker-compose up -d    # http://localhost:3000，数据持久化在 ./data
```

### 测试与构建

```bash
npm test           # vitest：数字句读/元信息/巨潮筛选/存储/AI提示词/pdfjs 文本层（28 用例）
npm run typecheck  # tsc --noEmit
npm run build      # next build（standalone）
```

## 路线图

| 阶段 | 内容 | 状态 |
|---|---|---|
| v0.1 | 阅读器 + 巨潮导入 + 数字句读 | ✅ |
| v0.2 | AI 解读：本页速览 + 划词问答（页码引用/无据拒答） | ✅ |
| M1 | 批注/高亮/书签云同步 + PWA + 数字同比层 | ⬜ |
| M2 | AI 能力深化：数字索引同比层 + 全文档检索问答 + 综合导读 | ⬜ |
| M3 | 标的档案 + 编年时间轴 + 跨期科目追踪 | ⬜ |
| M4 | 账户配额 + BYOK + 云端多用户 | ⬜ |
| M5 | 多层解读模板库（注家系统）开放贡献 | ⬜ |

完整产品定义见 [docs/BRD.md](docs/BRD.md) ｜ [docs/PRD.md](docs/PRD.md) ｜ [docs/技术设计.md](docs/技术设计.md)。

## 产品铁律

1. **伴读不替读**——原文恒在，AI 是侧栏、悬浮与注
2. **有据必引**——AI 回答必须引用页码，无据即答"不知道"
3. **数字程序算**——换算与统计由程序完成，AI 只解释
4. **整理不荐股**——影响方向是信息整理，判定权永远在用户

## 参与贡献

- 财报解析 bad case 请提 issue（附 PDF 页码截图），帮助我们积累测试集
- 解读模板（注家）将以 JSON 检查项形式开放 PR

## 许可

[AGPL-3.0](LICENSE)。个人使用与自部署无任何限制；商业授权可另谈。"句读"名称与标识为项目保留权利。

---

*本工具仅整理公开披露信息，不构成任何投资建议；数据以巨潮资讯网（cninfo.com.cn）原文为准。*
