# 《米粒》产品说明补充 V1.3

本补充用于锁定多端模式和图像生成接入规则，避免后续实现偏离当前产品方向。

## 1. 多端模式定位

当前项目继续使用微信开发者工具 `multiPlatform` 结构，目标是同时服务：

- 微信小程序
- Android 多端 App
- iOS 多端 App

多端模式不改变产品核心闭环：

```text
建档 -> 身材分析 -> 选择场景 -> 生成试穿图 -> 查看理由 -> 评分反馈
```

也不取消微信小程序端的包体、域名、HTTPS、并发、权限和审核限制。小程序端按最严格约束设计，多端 App 只做能力补充。

## 2. 图像生成策略

当前阶段图像生成固定策略：

- 模型：`gpt-image-2`
- 质量：`medium`
- 比例：`1024x1536`
- 返回：`url`
- 调用方：后端

中等质量用于验证透明 PNG 人物图和首页主题背景的融合效果。Prompt 必须继续保留人物与身材信息，包括年龄段、城市、身高、体重、身材类型、身材策略、避雷项、场景、穿搭标题和偏好色。

生成图方向改为：

```text
transparent-background PNG cutout
person and outfit only
alpha channel
no room / wall / floor / street background
```

## 3. Prompt 合同

每个生图任务必须包含结构化 `promptContract`。如果合同不完整，任务进入 `incomplete`，不提交 moxing。

这条规则的目的：

- 防止生成图只剩“好看的女生穿搭”，失去用户个人化。
- 防止模型过度拉腿、瘦身或改变身材。
- 让身材分析结果真正影响衣服版型和穿搭策略。

## 4. 小程序与 App 资源策略

开发环境可以把测试图下载到：

```text
packages/test-assets/generated/users/*.jpg
```

正式环境不能把生成图打入小程序主包。生成图、用户图、趋势图统一进入对象存储，再通过 CDN URL 返回给前端。

## 5. 文档索引

详细规则见：

```text
docs/IMAGE_GENERATION_CONTRACT.md
docs/MINIPROGRAM_MULTIPLATFORM_LIMITS.md
docs/ASSET_PIPELINE.md
```
