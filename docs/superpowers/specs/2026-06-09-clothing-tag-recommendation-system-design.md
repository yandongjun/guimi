# 衣服标签与穿搭推荐体系设计记录

## 背景

闺蜜 MVP 的核心不是生成一张好看的穿搭图，而是让用户相信：米粒知道我适合什么、知道我衣橱里有什么，并且能把这些衣服组合成今天真实能穿出去的一套。

如果推荐只依赖自由提示词，AI 会临场发挥，可能生成看起来不错但和用户衣橱无关的衣服。这样用户会觉得“这不是我的穿搭”。因此，推荐链路必须从结构化数据出发：用户画像、用户衣橱、平台衣服库和固定标签体系共同决定穿搭方案，图片生成只负责把方案可视化。

## 核心结论

用户穿搭里的衣服来源分为两类：

1. 用户衣橱：用户上传、从人物照片分割、或从穿搭评价中识别入库的真实单品。
2. 平台衣服库：由平台维护的趋势单品、基础款、可购买候选或风格参考单品。

推荐优先级固定为：

```text
用户衣橱 > 用户历史喜欢 > 平台衣服库 > 趋势抽象描述
```

MVP 规则：

- 只要用户衣橱有可用单品，每次推荐至少引用 1 件用户衣服。
- 用户衣橱能组成完整穿搭时，不主动推荐购买。
- 用户衣橱缺少关键品类时，平台衣服库只做补位。
- 用户没有衣橱数据时，才允许完整使用平台趋势库生成参考穿搭。
- 页面必须明确展示“用了你的哪些衣服”和“系统补了哪些单品”。

## 判断逻辑

系统不是直接用标签搜索衣服，而是先判断用户适合什么，再用标签找衣服。

```text
用户特征
→ 穿搭策略
→ 衣服标签筛选
→ 成套搭配
→ 生图提示词
→ 页面文案
```

用户适合什么，来自四类信息：

- 身材策略：例如窄肩、梨形偏沙漏、腿长偏优，对应补肩线、提高腰线、下装垂顺等策略。
- 场景需求：例如上班、约会、聚会、逛街、旅行。
- 天气舒适度：温度、风、雨、昼夜温差决定厚薄、材质、外套和鞋包风险。
- 用户偏好反馈：喜欢颜色、讨厌颜色、收藏、跳过、评分、现实愿穿程度。

标签搜索只是执行层。它负责把“补肩线、提高腰线、通勤、低饱和、适合 27/18 摄氏度”这些策略落到具体衣服上。

## 固定标签体系

衣服标签必须来自固定字典，不允许每次由模型自由发明。否则会出现同义词混乱，例如“奶白、米白、象牙白、奶油白”无法稳定匹配。

MVP 标签字典可以先用 JSON 文件维护，结构按数据库设计，后续迁移到 PostgreSQL。

建议标签维度：

| 维度 | 示例 | 用途 |
| --- | --- | --- |
| 品类 | top, outerwear, bottom, dress, shoes, bag, accessory | 判断穿搭结构 |
| 子品类 | blazer, shirt, jeans, a_line_skirt, trench_coat | 精确召回单品 |
| 颜色 | cream_white, mist_blue, dark_indigo, black | 匹配偏好和幸运色 |
| 色彩角色 | base_color, accent_color, neutral_color | 判断颜色占比 |
| 版型轮廓 | cropped, high_waist, straight, a_line, waist_defined | 判断比例效果 |
| 合身度 | slim, regular, relaxed, oversized | 判断体型适配 |
| 材质 | cotton, denim, knit, suit_fabric, satin, linen | 判断质感、季节和天气 |
| 厚薄 | light, medium, warm, windproof | 匹配温度和风 |
| 正式度 | casual, smart_casual, formal | 匹配场景 |
| 风格 | clean_fit, commute, korean, french, light_mature | 匹配审美 |
| 身材策略 | define_shoulder, raise_waistline, extend_leg, soften_hip | 判断是否适合用户 |
| 风险标签 | press_height, expose_hip, too_mature, too_sweet | 避免不合适推荐 |
| 场景 | office, dating, party, shopping, travel | 匹配使用场景 |
| 搭配关系 | needs_inner_layer, good_with_jeans, good_with_skirt | 生成完整穿搭 |

## 衣服实例数据

每件衣服入库后，需要保存标准化标签，而不是只保存描述文字。

```json
{
  "id": "c101",
  "userId": "user-a",
  "source": "user_closet",
  "name": "奶油白短西装",
  "category": "outerwear",
  "categoryLabel": "外套",
  "subCategory": "short_blazer",
  "color": "cream_white",
  "colorLabel": "奶油白",
  "silhouetteTags": ["cropped", "structured"],
  "materialTags": ["suit_fabric"],
  "styleTags": ["commute", "clean_fit"],
  "bodyStrategyTags": ["define_shoulder", "raise_waistline"],
  "sceneTags": ["office", "dating"],
  "weatherTags": ["light", "windproof"],
  "riskTags": [],
  "imageUrl": "https://cdn.example.com/closet/c101.jpg"
}
```

平台衣服库使用同一套标签结构，但 `source` 改为 `platform_library`、`trend_library` 或 `product_candidate`。

## 数据库方向

MVP 可以先用 JSON 和本地文件存储，但正式上线需要数据库。核心表建议如下：

### clothing_tag_dictionary

存系统允许使用的标准标签。

```text
id
type
code
label
parentCode
description
enabled
sortOrder
```

### clothing_items

统一存用户衣橱和平台衣服库。

```text
id
ownerType        // user / platform
userId
source          // user_closet / platform_library / trend_library / product_candidate
name
category
subCategory
color
tags            // JSON
imageAssetId
imageUrl
remoteImageUrl
createdAt
updatedAt
```

### outfit_recommendations

存每次结构化穿搭方案，保证首页、详情页、生图、记录页可追溯。

```text
id
userId
scene
title
mood
selectedItems   // JSON: user closet items + platform fill items
reasons         // JSON
score
imageJobId
tryOnImageUrl
createdAt
```

### user_style_profile

存用户身材策略、偏好和反馈学习结果。

```text
userId
bodyTags
strategyTags
avoidTags
favoriteColors
dislikedColors
favoriteStyleTags
rejectedStyleTags
updatedAt
```

## 衣服分析服务

衣服分析服务必须输出标准标签，不输出任意自然语言标签。

输入：

- 单件衣服图片。
- 或人物图片分割后的衣服图片。
- 可选：用户补充的名称、场景、购买来源。

输出：

```json
{
  "name": "深靛直筒牛仔裤",
  "category": "bottom",
  "subCategory": "straight_jeans",
  "color": "dark_indigo",
  "materialTags": ["denim"],
  "silhouetteTags": ["straight"],
  "fitTags": ["regular", "high_waist"],
  "styleTags": ["clean_fit", "relaxed"],
  "bodyStrategyTags": ["extend_leg"],
  "sceneTags": ["office", "shopping", "travel"],
  "weatherTags": ["medium"],
  "riskTags": []
}
```

约束：

- 模型可以识别，但最终结果必须映射到 `clothing_tag_dictionary`。
- 不认识的词进入 `rawDetectedTags`，不直接参与推荐。
- 低置信度标签需要人工确认或前端轻确认。

## 推荐编排服务

推荐服务的输入：

```text
用户画像
+ 身材策略
+ 天气
+ 场景
+ 幸运色
+ 用户衣橱
+ 平台衣服库
+ 用户历史反馈
```

推荐编排的角色提示词固定为：

```text
你是一位专业时尚穿搭顾问，了解最新时尚趋势。请基于用户画像、身材策略、天气、场景、用户衣橱和平台衣服库，生成一套现实可穿的结构化穿搭方案。优先使用用户衣橱；只有用户衣橱无法满足场景、天气或审美目标时，才从平台衣服库或者互联网信息补位。
```

这段提示词只用于选衣和生成结构化穿搭方案，不进入图片生成 prompt。图片生成只执行 `selectedItems`，不重新判断穿什么。

推荐服务的输出必须是结构化穿搭方案：

```json
{
  "scene": "office",
  "title": "薄外套 + 清爽内搭",
  "mood": "轻甜但不幼态",
  "selectedItems": [
    {
      "itemId": "c101",
      "source": "user_closet",
      "slot": "outerwear",
      "name": "奶油白短西装"
    },
    {
      "itemId": "p201",
      "source": "platform_library",
      "slot": "inner",
      "name": "浅蓝针织背心"
    }
  ],
  "usedClosetItemIds": ["c101"],
  "platformFillItemIds": ["p201"],
  "reasons": [
    "短外套提高腰线",
    "浅蓝内搭呼应幸运色",
    "直筒裤让整体更利落"
  ]
}
```

推荐打分建议：

```text
score =
身材策略匹配
+ 场景匹配
+ 天气匹配
+ 颜色偏好匹配
+ 用户历史喜欢
+ 衣橱使用优先
- 避雷标签
- 天气风险
- 场景不匹配
```

## 生图依据

生图提示词必须来自结构化穿搭方案，而不是让 AI 自己决定穿什么。

生图 prompt 应只描述事实：

```text
请让用户穿上：
- 用户衣橱：奶油白短西装
- 平台补位：浅蓝针织背心
- 用户衣橱：深靛直筒牛仔裤

生成干净全身试穿照，不要文字，不要说明，不要信息图。
```

生图不负责解释理由。理由由页面根据 `reasons` 字段展示。这样首页、详情页、记录页和生图依据保持一致。

## MVP 实施顺序

第一步：固定标签字典。

- 建立 `data/clothing-tag-dictionary.js` 或 JSON。
- 统一中英文 code 和中文 label。
- 当前系统内部使用 code，页面展示使用中文 label。

第二步：规范衣服入库。

- 用户上传单件衣服，生成标准标签。
- 用户上传人物图，先调用服饰分割，再逐件分析并入库。
- 入库结果在衣橱页可见。

第三步：改推荐输出。

- 推荐结果必须包含 `selectedItems`。
- 区分 `user_closet` 和 `platform_library`。
- 每次推荐至少尝试使用一件用户衣橱。

第四步：改生图 contract。

- prompt 只使用 `selectedItems` 和用户身体参考图。
- 不把理由文本传给图像模型。
- 图片任务保存 `recommendationId` 和 `selectedItemIds`。

第五步：补记录和评估。

- 记录页展示本次用了哪些用户衣服。
- 用户评分反写到 `user_style_profile`。

## 上线扩展原则

- 标签字典是平台资产，不能散落在 prompt 中。
- 衣服分析服务只能输出字典内标签。
- 推荐服务必须先生成结构化穿搭方案，再调用生图。
- 用户衣橱优先于平台库。
- 平台库用于补位，不默认导购。
- 购买链接只在用户主动找同款、找类似款时出现。
- 每次推荐都要可解释、可追溯、可复盘。

## 非目标

本设计不包含：

- 完整电商导购系统。
- 社区穿搭广场。
- 复杂协同过滤推荐。
- 自动购买链接聚合。
- 大规模后台运营系统。

这些能力可以在用户愿意持续打开每日穿搭后再扩展。
