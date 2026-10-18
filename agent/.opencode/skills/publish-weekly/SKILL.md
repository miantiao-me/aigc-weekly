---
name: publish-weekly
description: 使用 Payload REST API 将周刊发布到 CMS，正文不包含头部元数据，通过 users API Key 认证。
---

# Publish Weekly（发布周刊）

此技能用于将本地生成的周刊 Markdown 文件发布到 Payload CMS 的 `weekly` 集合中，状态设为 **已发布**（`status: published`），正文不包含文件开头的 YAML front matter。

## 前置条件

- 环境变量 `PAYLOAD_API_KEY`：来自 Payload `users` 集合为某个用户生成的 API Key。
- 环境变量 `PAYLOAD_BASE_URL`（推荐）：Payload/Next.js 服务的公开地址（例如 `http://localhost:3000`）。
- 环境变量 `BARK_PUSH_URL`（可选）：完整的 Bark 推送端点（例如 `https://push.example.com/push/token/`）；未配置时跳过通知。

## 输入

从 `/weekly` 命令的参数块中获取：

- `week_id`：如 `Y26W12`（写入 `issueNumber`）
- `title`：写入 `title`
- `filename`：周刊 Markdown 文件名（从工作目录读取，移除头部 YAML front matter 后写入 `content`）
- `current_date`：写入 `publishDate`（ISO 日期字符串）

可选：

- `summary`：周刊描述/摘要（写入 `summary`）。若未提供则从 `content` 提炼。
- `tags`：标签（字符串数组，例如 `["模型", "工具"]`）。写入 `tags` 数组字段。
- `links`：链接列表（对象数组，形如 `[{ label, url }]`），写入 `links`。

## 发布目标

- Collection: `weekly`
- REST Endpoint:
  - 查询：`GET {BASE_URL}/api/weekly?where[issueNumber][equals]={week_id}&limit=1`
  - 创建：`POST {BASE_URL}/api/weekly`
  - 更新：`PATCH {BASE_URL}/api/weekly/{id}`

## 认证方式（HTTP Header）

必须使用 Payload 的 API Key 认证头：

```
Authorization: users API-Key {PAYLOAD_API_KEY}
Content-Type: application/json
```

## 字段映射

发布/更新时写入以下字段：

- `title`（text, required）: `{title}`
- `summary`（textarea, required）:
  - 若提供了 `{summary}`：直接使用
  - 否则：从 `content` 提炼 1-2 句话（不超过 200 字）；如果文章开头已包含“摘要/导语”，优先复用
- `content`（textarea, required）: 读取 `{filename}`，若文件开头存在由独立行 `---` 包裹的 YAML front matter，移除整个头部块（包括两行分隔符），仅写入后续 Markdown 正文；没有头部块时保留原文，不移除正文中的 `---` 分隔线
- `issueNumber`（text, required, unique）: `{week_id}`
- `status`（select, required）: 固定写入 `published`
- `publishDate`（date, required）: `{current_date}`（建议 `YYYY-MM-DD`）

可选字段（若无就留空/不传）：

- `links`（array）: `{links}`，元素结构为 `{ label: string, url: string }`
- `tags`（array）: 将 `{tags}`（字符串数组）转换为 `[{ value: string }]`

## 请求 Body 示例

```json
{
  "title": "Agili 的 AIGC 周刊（Y26W12）",
  "issueNumber": "Y26W12",
  "publishDate": "2026-03-25",
  "status": "published",
  "summary": "本期聚焦推理模型的工程化落地，以及一批值得试用的生产力工具。",
  "content": "# ...不含头部 YAML front matter 的 Markdown 正文...",
  "links": [{ "label": "在线阅读", "url": "https://aigc-weekly.agi.li" }],
  "tags": [{ "value": "模型" }, { "value": "工具" }]
}
```

## 行为约束

1. **幂等**：优先按 `issueNumber == week_id` 查询：
   - 若已存在：用 `PATCH` 更新（覆盖 `title/summary/content/publishDate/status/links/tags`）。
   - 若不存在：用 `POST` 创建。
2. **发布状态与正文**：无论是创建还是更新，都必须写入 `status: "published"`，且 `content` 不得包含文件头部的 YAML front matter。
3. **产物落盘**：将创建/更新成功的响应 JSON 保存为 `published/{week_id}.json`，用于后续恢复与审计。
4. **失败可诊断**：若请求失败，输出：HTTP 状态码、响应 body（若有）、请求的 URL（不要泄露 `PAYLOAD_API_KEY`）。
5. **发布通知**：仅在 Payload `POST`/`PATCH` 成功且响应已保存到 `published/{week_id}.json` 后执行：
   - 若未配置 `BARK_PUSH_URL`，直接跳过。
   - 向 `BARK_PUSH_URL` POST JSON，5 秒超时：`title` 为 `{week_id}｜周刊已发布`，`body` 为 `{title}`，`url` 为 `{PAYLOAD_BASE_URL 去掉末尾斜杠}/admin/collections/weekly/{CMS 响应中的文档 id}`。
   - 必须用 JSON 序列化工具构造请求体，不得用字符串拼接生成 JSON；同时要求 HTTP 成功且响应 JSON 的 `code === 200`。
   - 通知失败只输出超时、HTTP 状态或响应码等诊断，不打印 `BARK_PUSH_URL` 或任何凭据；不得将已成功发布的周刊判为失败，也不得删除审计产物。
