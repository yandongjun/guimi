# Home Navigation And Studio Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved MVP navigation and homepage generated-image treatment: 4 bottom tabs plus a high-end studio stage that handles non-transparent PNGs gracefully.

**Architecture:** Keep the existing WeChat mini-program page structure. Convert `capture` and `evaluate` from tab-level pages into secondary-entry pages, add a lightweight `record` tab page, revise image prompt constraints in the Node backend, and update the home hero visual layers without changing the image generation provider or public file-server dependency.

**Tech Stack:** WeChat mini-program JavaScript/WXML/WXSS, `app.json` tabBar config, Node.js backend prompt builder, existing mock API/services.

---

## Scope Locks

- Do not change body-scan public file-server behavior.
- Do not remove sensitive debug logs.
- Do not refactor unrelated pages.
- Do not change the light-closet recommendation contract created in the previous task.

## File Structure

- Modify: `app.json`
  - Replace 5-tab bar with 4 tabs: home, closet, record, profile.
  - Keep `pages/capture/capture` and `pages/evaluate/evaluate` in `pages` so secondary navigation still works.

- Create: `pages/record/record.js`
  - Lightweight records/feedback hub with entry points to outfit detail and external outfit evaluation.

- Create: `pages/record/record.wxml`
  - Shows recent generated outfit copy and an action to open the existing evaluate page.

- Create: `pages/record/record.wxss`
  - Dense, restrained MVP styling consistent with current card system.

- Modify: `pages/profile/profile.wxml`
  - Add a high-priority body profile/build-record task card that navigates to `pages/capture/capture`.

- Modify: `pages/profile/profile.js`
  - Add `goCapture()`.

- Modify: `pages/profile/profile.wxss`
  - Style the build-record task card.

- Modify: `pages/home/home.wxml`
  - Add studio visual layers around the model image.
  - Rephrase closet source display as magazine-style annotation.

- Modify: `pages/home/home.wxss`
  - Add warm studio light, oval floor shadow, halo, and veil layers.
  - Rebalance headline, source copy, tags, and brand to avoid covering the generated model.

- Modify: `backend/server.js`
  - Add prompt instructions forbidding checkerboard/preview-grid backgrounds and fallback to clean warm-white studio background.

## Task 1: Navigation Shell

**Files:**
- Modify: `app.json`
- Create: `pages/record/record.js`
- Create: `pages/record/record.wxml`
- Create: `pages/record/record.wxss`

- [ ] **Step 1: Update `app.json` pages and tabBar**

Set `pages` to include `pages/record/record`, keep `capture` and `evaluate`, and set tabBar list to exactly:

```json
[
  { "pagePath": "pages/home/home", "text": "今日" },
  { "pagePath": "pages/closet/closet", "text": "衣橱" },
  { "pagePath": "pages/record/record", "text": "记录" },
  { "pagePath": "pages/profile/profile", "text": "我的" }
]
```

- [ ] **Step 2: Create `pages/record/record.js`**

Use existing `api.getHome()` to show the current outfit summary and provide:

```js
const api = require("../../services/api");

Page({
  data: {
    loading: true,
    outfit: null,
    quota: null
  },

  onShow() {
    this.loadRecord();
  },

  async loadRecord() {
    try {
      this.setData({ loading: true });
      const data = await api.getHome();
      this.setData({
        loading: false,
        outfit: data.dailyOutfit,
        quota: data.quota
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || "记录加载失败", icon: "none" });
    }
  },

  goDaily() {
    const id = this.data.outfit && this.data.outfit.generationId ? this.data.outfit.generationId : "";
    wx.navigateTo({ url: `/pages/daily/daily?id=${id}` });
  },

  goEvaluate() {
    wx.navigateTo({ url: "/pages/evaluate/evaluate" });
  }
});
```

- [ ] **Step 3: Create `pages/record/record.wxml`**

Render current outfit and the external outfit evaluation entry:

```xml
<view class="page record-page">
  <view wx:if="{{loading}}" class="card section empty">米粒正在翻记录...</view>

  <block wx:else>
    <view class="card record-hero" bindtap="goDaily">
      <text class="eyebrow">最近一次生成</text>
      <view class="title">{{outfit.displayTitle}}</view>
      <view class="subtitle">{{outfit.closetUsageCopy}}</view>
      <view class="record-meta">今日额度 {{quota.remaining}} / {{quota.limit}}</view>
    </view>

    <view class="card section">
      <text class="eyebrow">穿搭反馈</text>
      <view class="subtitle">回看详情页里的评分，米粒会记住不适合你的风格。</view>
      <button class="tiny-button record-action" bindtap="goDaily">查看今日反馈</button>
    </view>

    <view class="card section">
      <text class="eyebrow">外部穿搭点评</text>
      <view class="subtitle">上传一张现实穿搭照，米粒按比例、颜色、场景给出调整建议。</view>
      <button class="primary-button record-action" bindtap="goEvaluate">上传穿搭照点评</button>
    </view>
  </block>
</view>
```

- [ ] **Step 4: Create `pages/record/record.wxss`**

Add minimal styles:

```css
.record-hero {
  padding: 34rpx;
  border-radius: 28rpx;
  background: linear-gradient(135deg, #fffaf4 0%, #f2e4d8 100%);
}

.record-meta {
  margin-top: 18rpx;
  color: #9a1621;
  font-size: 24rpx;
  font-weight: 900;
}

.record-action {
  width: 100%;
  margin-top: 22rpx;
}
```

- [ ] **Step 5: Verify app config JSON parses**

Run:

```powershell
node -e "JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log('app.json ok')"
```

Expected output contains `app.json ok`.

## Task 2: Secondary Entrances For Capture And Evaluate

**Files:**
- Modify: `pages/profile/profile.js`
- Modify: `pages/profile/profile.wxml`
- Modify: `pages/profile/profile.wxss`

- [ ] **Step 1: Add `goCapture` to `pages/profile/profile.js`**

Add inside `Page({ ... })`:

```js
goCapture() {
  wx.navigateTo({ url: "/pages/capture/capture" });
},
```

- [ ] **Step 2: Add profile build-record card**

Place after the first companion card in `pages/profile/profile.wxml`:

```xml
<view class="build-profile-card section" bindtap="goCapture">
  <text class="eyebrow">三视图档案</text>
  <view class="build-title">先把身材档案建好，生成图才像你</view>
  <view class="build-copy">上传正面、侧面、背面三张图，米粒会用它们保持身高比例、肩腰臀和穿搭真实感。</view>
  <view class="build-action">去建档</view>
</view>
```

- [ ] **Step 3: Style profile build-record card**

Add to `pages/profile/profile.wxss`:

```css
.build-profile-card {
  padding: 30rpx;
  border-radius: 26rpx;
  background: linear-gradient(135deg, #fff7ee 0%, #f1ded4 100%);
  border: 1rpx solid rgba(154, 22, 33, 0.14);
}

.build-title {
  margin-top: 12rpx;
  color: #2f2925;
  font-size: 34rpx;
  line-height: 1.24;
  font-weight: 950;
}

.build-copy {
  margin-top: 12rpx;
  color: #7b6f68;
  font-size: 25rpx;
  line-height: 1.5;
}

.build-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 58rpx;
  margin-top: 22rpx;
  padding: 0 28rpx;
  border-radius: 999rpx;
  background: #9a1621;
  color: #fffaf6;
  font-size: 24rpx;
  font-weight: 900;
}
```

- [ ] **Step 4: Verify profile JavaScript syntax**

Run:

```powershell
node --check pages\profile\profile.js
```

Expected: exit code 0 with no output.

## Task 3: Prompt Contract Copy For Non-Transparent PNG Risk

**Files:**
- Modify: `backend/server.js`

- [ ] **Step 1: Add explicit prompt line in `buildImagePrompt`**

After the current transparent PNG requirement line, add:

```js
`请输出真实透明背景 PNG；如果模型无法保证真实 alpha 透明，请改用干净暖白纯色摄影棚背景。禁止出现灰白棋盘格、透明预览格、素材软件预览底、截图 UI、水印、边框或网格。`,
```

- [ ] **Step 2: Verify backend syntax**

Run:

```powershell
node --check backend\server.js
```

Expected: exit code 0 with no output.

- [ ] **Step 3: Verify prompt contains the new constraint**

Run an isolated backend smoke request and inspect logs:

```powershell
$env:PORT='8795'
$env:MOXING_API_KEY=''
$env:GUIMI_RUNTIME_DIR='E:\workspace\guimi\backend\storage\runtime-smoke-prompt-8795'
node -e "const http=require('http'); require('./backend/server'); const req=(path,method='GET',body)=>new Promise((resolve,reject)=>{const data=body?JSON.stringify(body):''; const r=http.request({hostname:'127.0.0.1',port:8795,path,method,headers:{'content-type':'application/json','content-length':Buffer.byteLength(data)}},res=>{let s='';res.on('data',c=>s+=c);res.on('end',()=>resolve(s))}); r.on('error',reject); if(data)r.write(data); r.end();}); setTimeout(async()=>{await req('/api/outfits/generate','POST',{scene:'上班',forceNew:true}); process.exit(0);},300);"
```

Expected log contains `禁止出现灰白棋盘格`.

## Task 4: Homepage Studio Stage

**Files:**
- Modify: `pages/home/home.wxml`
- Modify: `pages/home/home.wxss`

- [ ] **Step 1: Add studio layers in WXML**

Inside `.cover`, before the `<image class="model">`, add:

```xml
<view class="studio-glow"></view>
<view class="studio-floor"></view>
<view class="model-halo"></view>
```

After the image, add:

```xml
<view class="model-veil"></view>
```

- [ ] **Step 2: Rephrase closet source WXML**

Replace the existing `closet-source` view with:

```xml
<view wx:if="{{outfit.usedClosetItemLabels && outfit.usedClosetItemLabels.length}}" class="closet-source">
  <text class="closet-source-label">衣橱引用</text>
  <text class="closet-source-copy">{{outfit.usedClosetItemLabels.join(' / ')}}</text>
</view>
```

- [ ] **Step 3: Add studio layer CSS**

Add absolute positioning and visual layers:

```css
.studio-glow,
.studio-floor,
.model-halo,
.model-veil {
  position: absolute;
  pointer-events: none;
}

.studio-glow {
  right: 14rpx;
  top: 170rpx;
  z-index: 0;
  width: 520rpx;
  height: 940rpx;
  border-radius: 999rpx;
  background: radial-gradient(circle at 50% 38%, rgba(255, 252, 245, 0.96) 0%, rgba(255, 252, 245, 0.72) 34%, rgba(255, 252, 245, 0) 68%);
}

.studio-floor {
  right: 58rpx;
  bottom: 206rpx;
  z-index: 0;
  width: 430rpx;
  height: 74rpx;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(78, 57, 43, 0.18) 0%, rgba(78, 57, 43, 0.08) 48%, rgba(78, 57, 43, 0) 72%);
}

.model-halo {
  right: -74rpx;
  top: 182rpx;
  z-index: 1;
  width: 620rpx;
  height: 980rpx;
  border-radius: 48% 48% 36% 36%;
  background: linear-gradient(90deg, rgba(251, 246, 238, 0) 0%, rgba(251, 246, 238, 0.5) 42%, rgba(251, 246, 238, 0.9) 100%);
  filter: blur(12rpx);
}

.model-veil {
  inset: 0;
  z-index: 3;
  background: linear-gradient(90deg, rgba(251, 246, 238, 0.18) 45%, rgba(251, 246, 238, 0.32) 72%, rgba(251, 246, 238, 0.5) 100%);
}
```

- [ ] **Step 4: Rebalance existing home CSS**

Set `.model` to `z-index: 2`, `.photo-soften` to `z-index: 4`, and keep text layers at `z-index: 8`. Adjust:

```css
.headline { max-width: 340rpx; font-size: 60rpx; }
.closet-source { top: 620rpx; right: 270rpx; }
.brand-en { font-size: 178rpx; letter-spacing: -12rpx; }
```

- [ ] **Step 5: Verify home JavaScript syntax**

Run:

```powershell
node --check pages\home\home.js
```

Expected: exit code 0 with no output.

## Task 5: Final Verification

**Files:**
- Verify all touched files.

- [ ] **Step 1: Run syntax/config checks**

Run:

```powershell
node -e "JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log('app.json ok')"
node --check backend\server.js
node --check pages\home\home.js
node --check pages\profile\profile.js
node --check pages\record\record.js
```

Expected: `app.json ok` and no syntax errors.

- [ ] **Step 2: Search implementation markers**

Run:

```powershell
rg -n "pages/record/record|衣橱引用|studio-glow|禁止出现灰白棋盘格|goCapture|上传穿搭照点评" app.json pages backend
```

Expected: matches in `app.json`, `pages/home/home.wxml`, `pages/home/home.wxss`, `backend/server.js`, `pages/profile/profile.*`, and `pages/record/record.wxml`.

- [ ] **Step 3: Report residual risks**

Report:

- Prompt reduces checkerboard risk but cannot guarantee true alpha transparency.
- Frontend studio stage is a visual containment strategy, not pixel-level background removal.
- Existing dirty worktree was preserved; no unrelated changes were reverted.

