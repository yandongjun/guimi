# AI 穿搭推荐系统设计记录

## 背景

闺蜜的穿搭推荐不能只靠固定规则，也不能让生图模型临场发挥。固定规则会显得机械，生图模型自由发挥又会让衣服和用户衣橱脱节。MVP 后续要演进为一套 AI 驱动的穿搭推荐系统：AI 负责审美理解、标签补充、搭配判断和短文案生成，程序负责结构化数据、约束、版本、存证和可回溯。

目标不是一次性建成完整时尚百科，而是让系统具备持续变好的能力：每次上传衣服、每次生成推荐、每次赞踩，都能沉淀到可用的知识库里。

## 核心原则

1. AI 可以判断审美，但不能随便改字段。
2. 推荐必须能解释，解释必须能追溯到衣服、规则或用户反馈。
3. 图片生成只负责试穿图，不负责决定穿什么。
4. 首页短文案来自推荐结果，不来自图片 prompt。
5. 用户衣橱优先，但允许在缺口处用平台库或趋势信息补位。
6. 所有 AI 输出都要带置信度、来源和版本，低置信度先进入待确认状态。

## 总体架构

```text
用户画像 / 身材档案 / 天气 / 场景 / 风格
        ↓
AI 衣服理解服务
        ↓
衣服标签库
        ↓
AI 搭配知识服务
        ↓
搭配规则库
        ↓
AI 推荐服务
        ↓
推荐结果库
        ↓
生图任务 / 首页短评 / 记录页 / 用户反馈
        ↓
反馈学习服务
```

## 三个核心库

### 1. 衣服标签库

衣服标签库是标准化资产库。AI 可以识别和建议标签，但最终必须落到固定字段中，避免中文标签随意变化。

建议数据结构：

```json
{
  "itemId": "closet-001",
  "ownerUserId": "user-a",
  "sourceType": "wardrobe",
  "image": {
    "localPath": "/__runtime__/storage/closet/closet-001.jpg",
    "publicImageUrl": "https://...",
    "segmentedFromPersonImage": false
  },
  "taxonomy": {
    "category": "outerwear",
    "categoryLabel": "外套",
    "subCategory": "short_blazer",
    "subCategoryLabel": "短款西装"
  },
  "visualTags": {
    "colors": ["cream_white"],
    "colorLabels": ["奶油白"],
    "materialFeel": ["挺括", "轻薄"],
    "silhouette": ["短款", "微宽松"],
    "season": ["春", "秋", "夏空调房"]
  },
  "styleTags": ["通勤", "轻熟", "干净感"],
  "sceneTags": ["上班", "约会", "聚会"],
  "bodyEffectTags": ["补肩线", "提高腰线"],
  "riskTags": ["肩宽用户需谨慎"],
  "aiAnalysis": {
    "model": "vision-styling-v1",
    "confidence": 0.86,
    "source": "ai_generated",
    "reviewStatus": "accepted",
    "updatedAt": "2026-06-14T00:00:00.000Z"
  }
}
```

MVP 标准标签范围：

```text
品类：上衣、下装、连衣裙、外套、鞋、包、配饰
颜色：奶油白、深靛蓝、雾蓝、黑色、酒红、银灰、鼠尾草绿
风格：通勤、轻熟、休闲、复古、甜美、中性、知性、性感、淑女
场景：上班、约会、聚会、逛街、通勤
身材作用：提高腰线、补肩线、拉长腿线、弱化胯宽、降低上半身量感、修饰腿型
风险：压身高、显胯宽、显厚重、过于正式、过于甜腻、颜色冲突
```

### 2. 搭配规则库

搭配规则库不是纯人工规则库，而是 AI 结合时尚常识、生成结果和用户反馈持续沉淀的知识库。规则必须结构化，方便检索和评分。

建议数据结构：

```json
{
  "ruleId": "rule-short-jacket-high-waist",
  "pattern": {
    "items": ["短外套", "高腰下装"],
    "colors": [],
    "styleTags": ["轻熟", "通勤"]
  },
  "effect": "提高重心",
  "reason": "短外套压缩上半身视觉长度，高腰下装延长腿部线条。",
  "appliesTo": {
    "bodyStrategies": ["提高腰线", "拉长腿线"],
    "scenes": ["上班", "约会", "聚会"],
    "weather": []
  },
  "risk": {
    "description": "",
    "avoidWhen": []
  },
  "confidence": 0.82,
  "source": "ai_generated_with_feedback",
  "positiveFeedbackCount": 12,
  "negativeFeedbackCount": 2,
  "version": 1
}
```

规则示例：

```text
短外套 + 高腰下装：提高重心
奶油白 + 雾蓝：温柔清爽
厚重鞋 + 长裙：可能压身高
上身宽松 + 下身宽松：容易显拖沓
酒红 + 奶油白：有亮点但不显攻击性
深靛蓝直线条下装：稳定下半身比例
```

### 3. 推荐结果库

推荐结果库保存每次推荐的完整上下文，用于复盘、记录页展示、二次生成、用户偏好学习。

建议数据结构：

```json
{
  "recommendationId": "rec-001",
  "userId": "user-a",
  "scene": "约会",
  "stylePreference": "知性",
  "sourceMode": "wardrobe_first",
  "inputSnapshot": {
    "weather": "上海 27/18°C 舒适微风",
    "bodyStrategies": ["提高腰线", "补肩线"],
    "favoriteColors": ["奶油白", "雾蓝"],
    "rejectedStyleTags": []
  },
  "selectedItems": [
    {
      "itemId": "closet-blazer",
      "name": "短款奶油白西装",
      "source": "wardrobe",
      "slot": "外套",
      "why": "短外套稳住上身结构"
    }
  ],
  "missingSlots": ["轻薄内搭"],
  "appliedRuleIds": ["rule-short-jacket-high-waist"],
  "stylingNotes": [
    { "name": "单品逻辑", "copy": "短西装稳住主线" },
    { "name": "色彩逻辑", "copy": "奶油白提亮气色" },
    { "name": "修饰重点", "copy": "短上身抬高重心" }
  ],
  "imagePrompt": "clean full-body studio try-on...",
  "imageJobId": "img-001",
  "generatedImageUrl": "http://127.0.0.1:8787/assets/local/...",
  "feedback": {
    "rating": "like",
    "createdAt": "2026-06-14T00:00:00.000Z"
  },
  "aiMeta": {
    "model": "styling-recommender-v1",
    "confidence": 0.81,
    "reasoningSummary": "衣橱外套可用，缺口用轻薄内搭补位。"
  }
}
```

## AI 服务边界

### AI 衣服理解服务

输入：衣服图、分割图、用户可选修正。  
输出：标准标签、置信度、风险、适合场景、适合身材策略。

服务要求：

- 只能输出标准字段。
- 新标签只能进入 `candidateTags`，不能直接污染主标签库。
- 置信度低于 0.7 的关键字段标记为 `待确认`。
- 每次分析保留原始 AI 输出，便于回溯。

### AI 搭配知识服务

输入：衣服标签、推荐历史、用户反馈、时尚常识提示。  
输出：结构化搭配规则。

服务要求：

- 规则必须有适用条件和风险条件。
- 规则必须有来源：人工、AI、反馈强化。
- 被多次踩的规则降低权重，不直接删除。

### AI 推荐服务

输入：用户画像、身材策略、天气、场景、风格、衣橱、平台库、规则库、历史反馈。  
输出：结构化穿搭方案。

输出必须包含：

```json
{
  "selectedItems": [],
  "missingSlots": [],
  "appliedRules": [],
  "stylingNotes": [],
  "imagePrompt": "",
  "confidence": 0.8
}
```

`stylingNotes` 规则：

- 固定三条：单品逻辑、色彩逻辑、修饰重点。
- 每条 `copy` 不超过 18 个中文字符。
- 不写场景名。
- 不重复“衣橱引用”。
- 如果用了衣橱，把衣橱单品自然融入“单品逻辑”。
- 不写长句，不写“因为所以”。

## 推荐流程

```text
1. 用户选择场景、风格、是否优先衣橱
2. 读取用户画像、身材策略、天气、衣橱和历史反馈
3. 从衣橱中过滤季节、厚薄、场景不适配单品
4. AI 推荐服务结合规则库形成候选搭配
5. 程序校验必填槽位和风险条件
6. AI 输出短评和生图 prompt
7. 创建推荐结果记录
8. 创建生图任务
9. 首页展示推荐短评和试穿图
10. 用户赞踩反馈写回推荐结果库
11. 反馈学习服务更新偏好和规则权重
```

## MVP 落地顺序

### 第一阶段：结构先行

- 给当前 `recommendationSnapshot` 增加 `recommendationId`、`stylingNotes`、`appliedRules`、`sourceMode`。
- 首页只读 `stylingNotes`。
- 图片任务保存 `recommendationId` 和 `selectedItemIds`。
- 赞踩写回推荐结果。

### 第二阶段：AI 衣服理解

- 上传衣服后调用 AI 识别服务。
- 输出标准标签、候选标签和置信度。
- 衣橱页展示结构化标签和识别状态。

### 第三阶段：AI 推荐服务

- 把现有 `light-closet` 从规则函数升级为推荐编排服务。
- AI 先给候选方案，程序再做约束校验。
- 输出结构化推荐结果，再交给 image2 生图。

### 第四阶段：反馈学习

- 赞踩影响用户偏好。
- 重复被踩的颜色、风格、单品组合降低权重。
- 多次被赞的搭配规则提高权重。

## 风险和约束

- AI 审美不稳定：必须用结构化输出和规则校验兜底。
- 标签漂移：必须有标准字典和候选标签机制。
- 推荐解释虚假：每条说明必须能对应选中单品、颜色或规则。
- 生图不遵循衣橱：推荐结果要保留选中衣服和参考图，后续增加生成后校验。
- 反馈数据稀疏：MVP 先用赞踩和重新生成次数，不急着做复杂个性化模型。

## 当前结论

闺蜜的专业感来自“AI 审美判断 + 可解释结构化推荐”，不是来自机械规则，也不是来自自由生图。三个库都要建，但都应允许 AI 自动建设和持续更新；程序负责把 AI 的判断约束在稳定的数据结构中。
