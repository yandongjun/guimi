# 闺蜜 MVP 接口设计

所有接口返回：

```json
{
  "code": 0,
  "data": {}
}
```

## GET /api/home

首页聚合接口。

返回：

- `user`：用户基础偏好和闺蜜人设
- `weather`：天气摘要
- `bodyProfile`：身材比例档案
- `dailyOutfit`：今日推荐穿搭
- `closetCount`：衣橱单品数
- `trends`：趋势商品候选

## POST /api/body-scan/analyze

三视图分析。

请求：

```json
{
  "photos": {
    "front": "cloud://...",
    "side": "cloud://...",
    "back": "cloud://..."
  }
}
```

返回：

- `bodyType`：身材类型标签
- `shoulder`、`waistHip`、`legRatio`：关键比例判断
- `highlights`：优势
- `avoid`：避雷点
- `strategies`：穿搭策略
- `confidence`：模型可信度

## POST /api/outfit/evaluate

穿搭照点评。

请求：

```json
{
  "image": "cloud://..."
}
```

返回：

- `totalScore`：综合分
- `summary`：总评
- `evidence`：按比例、颜色、场景拆解的证据
- `actions`：可立即调整的动作
- `closetCandidates`：候选入库单品
- `generatedTryOnPrompt`：试穿图生成 prompt

## POST /api/outfits/daily

今日穿搭推荐。

请求：

```json
{
  "city": "上海",
  "scene": "上班"
}
```

返回：

- `weather`：当地天气
- `luckyColor`：星座幸运色
- `favoriteColors`：用户偏好色
- `outfit`：分层穿搭方案
- `trendItems`：最新流行商品候选
- `outfit.usedClosetItems`：本次引用的轻衣橱单品对象
- `outfit.usedClosetItemIds`：本次引用的轻衣橱单品 ID
- `outfit.usedClosetItemLabels`：本次引用的轻衣橱单品中文名
- `outfit.trendFillSlots`：趋势库补位槽位
- `outfit.sourceMix`：来源组合
- `outfit.closetUsageCopy`：前端可直接展示的来源说明

## GET /api/closet

衣橱列表与缺口分析。

返回：

- `items`：单品列表
- `gaps`：衣橱缺口
- `stats`：总数、颜色、可搭配完整度

## POST /api/closet/items

新增衣橱单品。

请求：

```json
{
  "name": "短款米白西装",
  "category": "outerwear",
  "color": "奶油白",
  "tags": ["通勤", "提肩线"]
}
```

## 生图任务接口

当前阶段使用“任务队列 + 人工回填图片”的方式验证审美，不让小程序直接调用图像生成模型。

详细协议见：

```text
docs/IMAGE_GENERATION_CONTRACT.md
docs/MINIPROGRAM_MULTIPLATFORM_LIMITS.md
docs/ASSET_PIPELINE.md
```

核心接口：

- `GET /api/image-jobs`：查询生图任务。
- `POST /api/image-jobs`：创建单个生图任务。
- `POST /api/image-jobs/seed-test-users`：生成 5 个测试用户任务。
- `POST /api/image-jobs/:id/complete`：回填图片。
- `POST /api/image-jobs/:id/submit`：提交单个任务到 moxing `gpt-image-2`。
- `POST /api/image-jobs/:id/poll`：轮询单个已提交任务。
- `POST /api/image-jobs/:id/download`：将任务远程图片下载到本地目标路径。
- `POST /api/image-jobs/run-pending`：批量提交 pending 任务。
- `POST /api/image-jobs/poll-submitted`：批量轮询 submitted / queued / processing 任务。
- `POST /api/image-jobs/:id/fail`：标记失败。

`POST /api/outfits/generate` 支持 `forceNew: true`，用于用户主动点击“重新生成”时创建新任务，避免复用旧图。
