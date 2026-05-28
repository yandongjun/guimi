# 米粒图片资产后端化方案

## 目标

小程序前端不长期保存原图，只保存少量低清示例图。用户上传图、三视图原图、生图结果、趋势库图统一进入后端图片资产层，前端只拿 `url` 或 `previewUrl` 渲染。

## 当前开发实现

后端新增资产接口：

- `GET /api/assets`：按 `group/type/slot` 查询图片资产。
- `GET /api/assets/:id`：查询单张图片资产。
- `POST /api/assets/upload`：小程序通过 `wx.uploadFile` 上传图片，后端保存到 `backend/storage/uploads`。
- `POST /api/assets/register`：登记已有远程图或手工放置的本地图。
- `GET /assets/local/*`：本地开发静态图片服务。

前端新增：

- `api.getAssets(filter)`：获取资产 URL。
- `api.uploadAsset(payload)`：上传三视图、衣橱图、点评图等用户图片。
- 建档页三视图上传后保存 `photoAssets`，分析接口接收资产对象，不再只依赖本地临时路径。

## GitHub 测试图床

测试阶段可以把仓库公开图片作为临时图床。配置方式：

```powershell
$env:GITHUB_IMAGE_BASE_URL="https://raw.githubusercontent.com/yandongjun/guimi/main"
node backend/server.js
```

后端会把 `storage: "repo"` 的静态资产解析成：

```text
https://raw.githubusercontent.com/yandongjun/guimi/main/packages/test-assets/generated/users/user-a-office.png
```

注意：

- GitHub 只适合测试，不适合生产图片服务。
- 用户上传图不应该提交 GitHub，正式环境应改为 OSS/COS/S3。
- 涉及真人照片时，必须有删除、权限、审核、隐私说明。

## 生产替换

生产期保留接口形态不变，只替换资产存储实现：

```text
wx.uploadFile -> 后端 -> 对象存储私有桶 -> CDN/签名 URL -> 前端 image
```

推荐字段：

```json
{
  "id": "asset-id",
  "type": "body_scan | generated_tryon | wardrobe_item | trend_item",
  "group": "body_scan_uploads",
  "slot": "front",
  "url": "https://cdn.example.com/full.png",
  "previewUrl": "https://cdn.example.com/preview.jpg",
  "mimeType": "image/png",
  "source": "upload",
  "meta": {}
}
```
