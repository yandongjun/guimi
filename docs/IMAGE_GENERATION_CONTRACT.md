# 图像生成 Prompt 合同

图像生成必须优先保护“像用户、适合用户、符合身材策略”这三个目标。当前使用中等质量生成，以验证透明 PNG 人物图在首页主题背景上的融合效果；但不能为了缩短 prompt 而删掉人物和身材信息。

## Provider 固定参数

```json
{
  "capability": "image_generation",
  "model": "gpt-image-2",
  "n": 1,
  "quality": "medium",
  "response_format": "url",
  "size": "1024x1536"
}
```

轮询路径固定为：

```text
GET https://www.moxing.pro/v1/media/tasks/:task_id
```

小程序不直接调用 moxing。后端读取 `MOXING_API_KEY`，负责提交、轮询、下载、失败处理。

Prompt 必须明确要求透明背景：

```text
transparent-background PNG cutout, alpha channel, person and outfit only, no room, no wall, no floor, no street, no background props
```

## Prompt 必填信息

每个提交给图像模型的任务都必须包含以下信息：

| 字段 | 说明 |
| --- | --- |
| `ageRange` | 用户年龄段 |
| `city` | 用户城市 |
| `heightCm` | 身高 |
| `weightKg` | 体重 |
| `bodyType` | 身材类型 |
| `strategies` | 身材穿搭策略 |
| `avoid` | 需要避开的版型或搭配 |
| `scene` | 使用场景 |
| `outfitTitle` | 穿搭标题 |
| `favoriteColors` | 用户偏好色 |

后端任务中通过 `promptContract` 保存结构化合同。提交前会校验合同；缺字段时任务进入 `incomplete`，不会调用 moxing。

## 状态机

```text
pending
submitted
queued
running
ready
failed
incomplete
```

- `incomplete`：prompt 合同缺失，未提交模型。
- `ready`：远程图片已取得，并在开发环境下载到 `targetPath`。
- `failed`：模型返回失败、轮询失败或图片下载失败。

## 图片存储

开发环境：

```text
remoteImageUrl -> download -> targetPath -> imageUrl
```

首页优先使用透明 PNG，以避免生成图背景和米色 / 粉色 / 酷炫主题冲突。

生产环境：

```text
remoteImageUrl -> backend download -> OSS/COS/S3 -> CDN imageUrl
```

生成图不能长期打入小程序主包。当前 `packages/test-assets/generated/users/*.jpg` 只用于开发和预览验证。
