---
description: 创建 AIGC 周刊
---

请你作为一名资深的技术编辑，帮助我创建一份关于人工智能生成内容（AIGC）的周刊。

## 时间计算

使用 `.opencode/utils.mjs` 中的 `getWeekInfo()` 函数计算时间参数：

```javascript
import { formatWeekParams, getWeekInfo, getWeeklyFilename, getWeeklyTitle } from '.opencode/utils.mjs'

const weekInfo = getWeekInfo($1) // $1 为用户输入的日期参数（可选）
const params = formatWeekParams(weekInfo)
const filename = getWeeklyFilename(weekInfo) // 如 "aigc-weekly-y25-w02.md"
const title = getWeeklyTitle(weekInfo) // 如 "Agili 的 AIGC 周刊（Y26W12）"
```

## 参数块格式

所有下游任务必须接收并原样传递以下参数块：

```yaml
# 周刊参数
week_id: Y26W12
week_number: 12
year_short: 26
year_full: 2026
start_date: 2026-03-22
end_date: 2026-03-28
current_date: 2026-03-25
timezone: UTC+0
```

## 准备工作

在开始各阶段任务前，必须完成：

1. 调用 `getWeekInfo()` 计算时间参数
2. 创建 `drafts/`、`logs/` 和 `published/` 目录（如不存在）
3. 生成参数块，用于传递给所有下游任务

## 进度管理（产物即状态）

每个阶段开始前，检查**产物是否存在**来判断恢复点：

| 阶段    | 完成标志                            | 恢复动作                     |
| ------- | ----------------------------------- | ---------------------------- |
| Phase 1 | `drafts/` 目录存在且有 `.md` 文件   | 跳过 Phase 1，进入 Phase 2   |
| Phase 2 | `drafts.yaml` 文件存在              | 跳过 Phase 1-2，进入 Phase 3 |
| Phase 3 | `images.yaml` 文件存在              | 跳过 Phase 1-3，进入 Phase 4 |
| Phase 4 | `{filename}` 文件存在               | 跳过 Phase 1-4，进入 Phase 5 |
| Phase 6 | `published/{week_id}.json` 文件存在 | 跳过 Phase 1-6，任务完成     |

`images.yaml` 即使内容为 `images: []` 也是合法的 Phase 3 完成标志。`logs/weekly-{week_id}.log` 仅用于人类审计，不作为恢复依据。

## 工作流程

请按照以下步骤操作，协调各个子任务完成工作：

### 1. 收集内容 (Phase 1)

使用 `batch-research` 技能进行批量数据采集。

**输入参数**：将完整周刊参数传递给技能。

**产出**：`drafts/` 目录下的草稿文件。Researcher 在抓取正文时同步收集图片候选，但不下载图片。

### 2. 筛选信息 (Phase 2)

调用 `editor` 子任务：

```text
prompt: |
  筛选 drafts/ 目录中的内容。

  # 周刊参数
  week_id: {weekInfo.weekId}
  week_number: {weekInfo.weekNumber}
  year_short: {weekInfo.yearShort}
  year_full: {weekInfo.yearFull}
  start_date: {weekInfo.startDate}
  end_date: {weekInfo.endDate}
  current_date: {weekInfo.currentDate}
  timezone: {weekInfo.timezone}

  请对内容进行筛选、去重和打分，生成 drafts.yaml。
```

**产出**：`drafts.yaml` 高价值内容列表。

### 3. 筛选图片 (Phase 3)

Phase 3 开始时创建 `tmp/images/{week_id}/` 目录，用于保存视觉检查所需的临时图片。

调用 `image-editor` 子任务：

```text
prompt: |
  为 drafts.yaml 中的入选条目筛选正文图片。

  # 周刊参数
  week_id: {weekInfo.weekId}
  week_number: {weekInfo.weekNumber}
  year_short: {weekInfo.yearShort}
  year_full: {weekInfo.yearFull}
  start_date: {weekInfo.startDate}
  end_date: {weekInfo.endDate}
  current_date: {weekInfo.currentDate}
  timezone: {weekInfo.timezone}

  请按图片编辑契约生成 images.yaml。
```

**产出**：`images.yaml` 图片元数据。若 `image-editor` 失败或没有合适图片，主流程必须写入合法的 `images: []` 后继续，不得阻塞本期。

图片字节仅保存在 sandbox 的 `tmp/images/{week_id}/`，通过 `read` 交给当前视觉模型检查，不得进入 Payload、R2、`drafts/` 或发布产物；无需主动清理，由 sandbox 生命周期统一回收。

### 4. 撰写内容 (Phase 4)

调用 `writer` 子任务：

```text
prompt: |
  撰写周刊内容。

  # 周刊参数
  week_id: {weekInfo.weekId}
  week_number: {weekInfo.weekNumber}
  year_short: {weekInfo.yearShort}
  year_full: {weekInfo.yearFull}
  start_date: {weekInfo.startDate}
  end_date: {weekInfo.endDate}
  current_date: {weekInfo.currentDate}
  timezone: {weekInfo.timezone}
  title: {title}
  filename: {filename}

  请基于 drafts.yaml 和 images.yaml 撰写周刊，保存为 {filename}。
```

**产出**：最终的 Markdown 周刊文件。

### 5. 审核与修订 (Phase 5)

调用 `reviewer` 子任务：

```text
prompt: |
  审核周刊文件 {filename}，包括正文和图片。

  # 周刊参数
  week_id: {weekInfo.weekId}
  week_number: {weekInfo.weekNumber}
  year_short: {weekInfo.yearShort}
  year_full: {weekInfo.yearFull}
  start_date: {weekInfo.startDate}
  end_date: {weekInfo.endDate}
  current_date: {weekInfo.currentDate}
  timezone: {weekInfo.timezone}
```

**循环逻辑**：

- 如果 Reviewer 返回 "PASS"，进入 Phase 6 发布。
- 如果 Reviewer 返回修改意见，调用 `writer` 子任务进行幂等修改，再调用 `reviewer` 复核。
- 此过程最多重复 3 次。

### 6. 发布周刊 (Phase 6)

使用 `publish-weekly` 技能将 `{filename}` 幂等写入 Payload CMS，状态设为已发布（`status: published`）。写入 `content` 前，移除文件开头由独立行 `---` 包裹的 YAML front matter，仅保留 Markdown 正文。

**输入参数**：将完整周刊参数传递给技能（包含 `title` 与 `filename`）。

**产出**：`published/{week_id}.json`（保存 CMS 响应，用于恢复与审计）。

确认 Payload 周刊发布成功并将 CMS 响应落盘后，按 `publish-weekly` 技能执行可选 Bark 通知；通知失败不影响 Phase 6 完成状态，也不得删除落盘产物。

---

请务必一次性完成所有任务，过程中无需向我确认。
