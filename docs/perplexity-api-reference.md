# Perplexity Sonar API Reference

Chat Buddy Scholar 智能体集成文档。

[English](#english) | [中文](#中文)

---

## English

### Model Selection

| Model | Best For | Cost |
|-------|----------|------|
| `sonar-small` | Quick facts | $ |
| `sonar-large` | Complex reasoning (default) | $$ |
| `sonar-pro` | Deep research | $$$ |
| `sonar-reasoning-pro` | Math, logic | $$$$ |

### Response Structure

```json
{
  "choices": [{ "message": { "content": "Answer with [1] citations..." }}],
  "search_results": [
    { "title": "Page Title", "url": "https://...", "snippet": "..." }
  ]
}
```

Citation mapping: `[1]` → `search_results[0]`

### API Parameters

```javascript
{
  model: "sonar-pro",
  messages: [...],
  return_citations: true,
  search_domain_filter: ["arxiv.org", "nature.com"],
  search_recency_filter: "week",
  temperature: 0.2
}
```

### Domain Presets

- Academic: `["arxiv.org", "nature.com", "ieee.org", ".edu"]`
- News: `["reuters.com", "bbc.com", "nytimes.com"]`
- Tech: `["github.com", "stackoverflow.com"]`

### Integration

```javascript
import { sonarSearch, DOMAIN_PRESETS } from '../services/perplexityService';

const result = await sonarSearch("query", {
  domainFilter: DOMAIN_PRESETS.ACADEMIC,
  recency: 'year'
});
```

### Environment

```env
VITE_AI_API_URL=https://api.perplexity.ai
VITE_AI_API_KEY=pplx-xxx
VITE_AI_MODEL=sonar-pro
```

---

## 中文

### 模型选择

| 模型 | 适用场景 | 成本 |
|------|----------|------|
| `sonar-small` | 快速查询 | $ |
| `sonar-large` | 复杂推理（默认） | $$ |
| `sonar-pro` | 深度研究 | $$$ |
| `sonar-reasoning-pro` | 数学、逻辑 | $$$$ |

### 响应结构

```json
{
  "choices": [{ "message": { "content": "带 [1] 引用的回答..." }}],
  "search_results": [
    { "title": "页面标题", "url": "https://...", "snippet": "..." }
  ]
}
```

引用映射：`[1]` → `search_results[0]`

### API 参数

```javascript
{
  model: "sonar-pro",
  messages: [...],
  return_citations: true,
  search_domain_filter: ["arxiv.org", "nature.com"],
  search_recency_filter: "week",
  temperature: 0.2
}
```

### 领域预设

- 学术：`["arxiv.org", "nature.com", "ieee.org", ".edu"]`
- 新闻：`["reuters.com", "bbc.com", "nytimes.com"]`
- 技术：`["github.com", "stackoverflow.com"]`

### 集成示例

```javascript
import { sonarSearch, DOMAIN_PRESETS } from '../services/perplexityService';

const result = await sonarSearch("查询内容", {
  domainFilter: DOMAIN_PRESETS.ACADEMIC,
  recency: 'year'
});
```

### 环境配置

```env
VITE_AI_API_URL=https://api.perplexity.ai
VITE_AI_API_KEY=pplx-xxx
VITE_AI_MODEL=sonar-pro
```

---

*更新于: 2026-01-10*
