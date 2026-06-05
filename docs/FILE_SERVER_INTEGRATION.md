# 文件服务器对接方案

## 概述

阿里云服务器 `8.146.205.102` 上已部署了一个 Node.js 文件服务器，域名 `https://upload.nextself.top`，用于存储和分发图片资源。本方案将 Guimi 后端当前的本地/ GitHub 图片存储替换为该文件服务器，所有生成的、上传的图片统一通过文件服务器管理。

## 文件服务器信息

| 项目 | 值 |
|------|-----|
| 公网域名 | `https://upload.nextself.top` |
| 内网地址 | `http://127.0.0.1:3000`（同机部署可用） |
| 类型 | Node.js Express，使用 multer 处理上传 |
| 限制 | 单文件最大 10MB，仅接受图片/视频/音频 |
| 后台管理 | `https://upload.nextself.top/admin-ui/` |

## API 接口

### 健康检查

```bash
GET /api/health
```

响应：
```json
{ "success": true, "service": "file-server", "time": "..." }
```

### 上传文件

```bash
POST /api/upload
Content-Type: multipart/form-data
x-user-name: <userName>
x-user-key: <userKey>
```

或 body 字段替代 header：
```
userName, userKey, file
```

成功响应：
```json
{
  "success": true,
  "message": "Upload completed",
  "data": {
    "id": "uuid",
    "mediaKind": "image",
    "mimeType": "image/png",
    "extension": "png",
    "originalName": "filename.png",
    "storedName": "filename-uuid.png",
    "relativePath": "guimi-backend/202606/filename-uuid.png",
    "sizeBytes": 123456,
    "sha256": "hash",
    "width": 1024,
    "height": 1536,
    "publicUrl": "https://upload.nextself.top/api/files/guimi-backend/202606/filename-uuid.png",
    "createdAt": "2026-06-02T..."
  }
}
```

### 访问文件

上传返回的 `publicUrl` 可直接用于 `<image>` 标签或 `wx.previewImage`。

## 账号

已在文件服务器上创建 Guimi 专用账号：

| 字段 | 值 |
|------|-----|
| userName | `guimi-backend` |
| userKey | `guimi-upload-2026` |
| quota | 50GB |

后端启动时需将这两个值写入环境变量，用于所有上传请求。

如需创建更多账号，SSH 登录后执行：

```bash
cd /usr/ydj/file-server
node dist/cli/admin.js create-user <用户名> <密钥> <配额GB>
```

管理后台：`https://upload.nextself.top/admin-ui/`（管理员令牌见服务器 `.env` 的 `ADMIN_TOKEN`）

## 对接改动点

以下列出 Guimi 后端需要修改的文件和改动内容。

### 1. 新增环境变量

后端运行时需设置以下环境变量（建议在 `backend/.env` 或系统环境变量中配置）：

```bash
FILE_SERVER_UPLOAD_URL=https://upload.nextself.top/api/upload
FILE_SERVER_BASE_URL=https://upload.nextself.top
FILE_SERVER_USER_NAME=guimi-backend
FILE_SERVER_USER_KEY=guimi-upload-2026
```

### 2. 新增上传模块 `backend/file-server-uploader.js`

创建一个独立的上传模块，封装文件服务器交互逻辑：

- 接收本地文件路径 + 可选元数据
- 用 `form-data` 或 `node-fetch` + `FormData` 构造 multipart 请求
- 设置 `x-user-name` 和 `x-user-key` 请求头
- 向 `FILE_SERVER_UPLOAD_URL` 发起 POST 请求
- 解析返回的 `publicUrl`，返回给调用方

方法签名建议：

```javascript
async function uploadToFileServer(filePath, options = {}) {
  // filePath: 本地文件的绝对路径
  // options.originalName: 可选，保留原始文件名
  // options.userName: 可选，覆盖默认用户名
  // options.userKey: 可选，覆盖默认密钥
  // 返回: { publicUrl, sizeBytes, width, height, mimeType }
}
```

### 3. 修改 `backend/server.js`

当前图片生成完成后，通过 `localizeImageResult`（第 822 行）将远程图片下载到本地 `targetPath`，然后通过 `assetStore.registerUploadedAsset` 注册为本地资源。

改为：下载到临时文件后，调用 `fileServerUploader.uploadToFileServer()` 上传至文件服务器，然后将返回的 `publicUrl` 作为 `remoteUrl` 存入资产。

具体改动点：

#### 3a. 在 `localizeImageResult` 中（~第 854 行）

当前代码：
```javascript
const downloaded = await imageDownloader.downloadImageToTarget(resolvedImageUrl, job.targetPath);
const downloadedAsset = assetStore.registerUploadedAsset({
  id: `generated-${job.id}`,
  type: "generated_tryon",
  group: "daily_tryon",
  localPath: downloaded.localPath,
  mimeType: ...,
  source: "image_job",
  meta: { imageJobId: job.id, userId: job.userId, scene: job.scene }
}, req);
return {
  status: "ready",
  imageUrl: downloadedAsset.previewUrl || downloadedAsset.url,
  imageAsset: downloadedAsset,
  remoteImageUrl: resolvedImageUrl,
  localImageBytes: downloaded.bytes
};
```

改为：
```javascript
const downloaded = await imageDownloader.downloadImageToTarget(resolvedImageUrl, job.targetPath);
const uploadResult = await uploadToFileServer(downloaded.localPath, {
  originalName: path.basename(job.targetPath)
});
const downloadedAsset = assetStore.registerUploadedAsset({
  id: `generated-${job.id}`,
  type: "generated_tryon",
  group: "daily_tryon",
  localPath: downloaded.localPath,
  remoteUrl: uploadResult.publicUrl,
  mimeType: ...,
  source: "image_job",
  meta: {
    imageJobId: job.id,
    userId: job.userId,
    scene: job.scene,
    fileServerUrl: uploadResult.publicUrl
  }
}, req);
return {
  status: "ready",
  imageUrl: uploadResult.publicUrl,
  imageAsset: downloadedAsset,
  remoteImageUrl: resolvedImageUrl,
  localImageBytes: downloaded.bytes
};
```

#### 3b. 用户上传接口（第 969 行附近）

当前 `POST /api/assets/upload` 把用户上传的图片直接存到本地 `uploadsDir`。

改为：保存临时文件后，调用 `uploadToFileServer()` 上传，然后注册资产时填写 `remoteUrl`。

#### 3c. 抠图结果 / 三视图合成图

所有通过 `createReferenceCutoutImages`（第 304 行）和 `createReferenceCompositeImages`（第 360 行）生成的中间图片，也应上传到文件服务器，避免本地存储膨胀。

### 4. 修改 `backend/asset-store.js`

当前 `buildUrl` 函数（第 59 行）中，如果 `asset.remoteUrl` 存在则直接返回。上传到文件服务器后，`remoteUrl` 已设置为 `publicUrl`，因此前端访问时能直接拿到正确的 URL。

无需额外改动，但建议在资产元数据中记录 `fileServerUrl` 以便追踪。

### 5. 删除或保留本地存储

- 首次上线时，可以先同时写入本地和上传文件服务器（双写模式），确认文件服务器稳定后再去掉本地存储。
- 稳定后：删除 `localizeImageResult` 中的本地 `targetPath` 写入逻辑，改为只通过文件服务器。

## 依赖包

需要在 `backend/package.json` 中添加：

```json
"form-data": "^4.0.0",
"node-fetch": "^2.7.0"
```

如果后端使用 Node 18+，也可以直接用内置 `fetch` + `FormData`，无需额外依赖。

## 实现步骤（给另一个 agent）

以下按顺序列出实现步骤：

### Step 1: 创建上传模块

创建 `backend/file-server-uploader.js`，实现 `uploadToFileServer()` 函数。

### Step 2: 修改 image pipeline

修改 `backend/server.js` 的 `localizeImageResult` 函数，在下载图片后上传到文件服务器。

### Step 3: 修改用户上传

修改 `POST /api/assets/upload` 路由，将上传文件同时或仅保存到文件服务器。

### Step 4: 配置环境变量

确保部署时设置 `FILE_SERVER_USER_NAME` 和 `FILE_SERVER_USER_KEY`。

### Step 5: 测试验证

启动后端，发起一次图片生成流程，确认：
1. 图片生成完成
2. 文件服务器上出现该文件（可在管理后台查看）
3. 前端能通过 `publicUrl` 正常显示图片

## 项目当前状态

- 后端入口：`backend/server.js`
- 图片下载：`backend/image-downloader.js`
- 资产注册：`backend/asset-store.js`
- 文件服务器已在 `upload.nextself.top` 运行
- 测试用户 `guimi-backend` 已创建，可用
