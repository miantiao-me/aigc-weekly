---
name: batch-research
description: 批量数据采集技能，负责分批并发调度 researcher agent 抓取所有数据源。
---

# Batch Research 技能

此技能用于指导 `/weekly` 命令如何高效、分批、并发地从多个数据源采集信息。

## 核心职责

作为批量调度器，负责：

1. 解析数据源列表
2. 生成所有待抓取 URL
3. 分批并发调用 `researcher` agent
4. 汇总结果生成报告

## 工作流程

### Step 1: 准备阶段

1. **读取数据源**：从 `.opencode/REFERENCE.md` 获取完整数据源列表
2. **生成 URL 列表**：
   - 静态 URL：直接使用
   - 动态 URL（Hacker News）：使用 `generateHNUrls(start_date, end_date)`

```javascript
import { generateHNUrls } from '.opencode/utils.mjs'

// Hacker News - 每天一个 URL
const hnUrls = generateHNUrls(start_date, end_date)
// 返回: [
//   "https://news.ycombinator.com/front?day=2026-03-22",
//   "https://news.ycombinator.com/front?day=2026-03-23",
//   ...
// ]
```

### Step 2: 分批策略

将所有 URL 按优先级分为 3 批，每批 10-12 个 URL：

| 批次        | 数据源类型          | 来源                                       |
| ----------- | ------------------- | ------------------------------------------ |
| **Batch 1** | Important Resources | REFERENCE.md 中 "Important Resources" 部分 |
| **Batch 2** | Blogs & Websites    | REFERENCE.md 中 "Blogs & Websites" 部分    |
| **Batch 3** | KOL & Influencers   | REFERENCE.md 中 "KOL & Influencers" 部分   |

### Step 3: 并发调度

#### 并发配置

| 参数                | 值           | 说明           |
| ------------------- | ------------ | -------------- |
| `max_parallel`      | 5            | 每轮最大并发数 |
| `batch_interval`    | 3s           | 批次间等待时间 |
| `domain_rate_limit` | 2 req/domain | 同域名限流     |

#### 调度规则

对每个批次：

1. **分轮执行**：将批次内 URL 按 `max_parallel` 分轮（如 12 个 URL 分 3 轮：5 + 5 + 2）
2. **轮内并发**：同时启动该轮所有 `researcher` agent
3. **等待完成**：等待当前轮所有 researcher 返回结果
4. **进入下一轮**：当前轮全部完成后，等待 `batch_interval`，再启动下一轮
5. **批次完成后**：进入下一个批次

**调用 researcher 的参数格式**：

```yaml
url: https://news.ycombinator.com/front?day=2026-03-22
source_name: Hacker News
week_id: Y26W12
start_date: 2026-03-22
end_date: 2026-03-28
current_date: 2026-03-25
timezone: UTC+0
```

**并发调用示例**（伪代码）：

```
# Batch 1: Important Resources
并行调用：
  - researcher(url: "https://news.ycombinator.com/front?day=2026-03-22", source_name: "Hacker News")
  - researcher(url: "https://news.ycombinator.com/front?day=2026-03-23", source_name: "Hacker News")
  - researcher(url: "https://drafts.miantiao.me/", source_name: "Miantiao Drafts")
  - researcher(url: "https://www.solidot.org/search?tid=151", source_name: "Solidot")
  - ...

等待 Batch 1 全部完成

# Batch 2: Blogs & Websites
并行调用：
  - researcher(url: "https://www.anthropic.com/engineering", source_name: "Anthropic Engineering")
  - researcher(url: "https://claude.com/blog", source_name: "Claude Blog")
  - ...

等待 Batch 2 全部完成

# Batch 3: KOL & Influencers
并行调用：
  - researcher(url: "https://baoyu.io/", source_name: "Baoyu")
  - ...

等待 Batch 3 全部完成
```

### Step 4: 日志记录

所有日志统一写入 `logs/weekly-{week_id}.log`，**仅用于人类审计**，不作为恢复依据。

**日志格式**：

```
[2026-03-25T12:34:56Z] [PHASE1] [INFO] 开始抓取 Hacker News
[2026-03-25T12:35:10Z] [PHASE1] [OK] Hacker News - 5 篇文章
[2026-03-25T12:35:15Z] [PHASE1] [FAIL] daily.dev - 429 Too Many Requests (retried 2)
```

**日志级别**：

| 级别   | 用途                             |
| ------ | -------------------------------- |
| `INFO` | 阶段/任务开始                    |
| `OK`   | 任务成功（含文章数）             |
| `FAIL` | 任务失败（含错误原因和重试次数） |

### Step 5: 汇总报告

所有批次完成后，在日志末尾生成汇总：

```
[2026-03-25T12:45:00Z] [PHASE1] [SUMMARY] 总数据源: 30 | 成功: 27 (X篇) | 失败: 3
```

## 约束与注意事项

- **全量抓取**：必须抓取所有数据源，不能跳过
- **批次顺序**：必须按批次顺序执行，等待当前批次完成后再进入下一批
- **错误隔离**：单个 researcher 失败不影响其他
- **重试由 researcher 处理**：本技能不负责重试，由 researcher 自行处理
- **进入下一阶段前**：必须完成所有批次的抓取
