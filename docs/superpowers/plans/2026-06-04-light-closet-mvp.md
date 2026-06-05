# Light Closet MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a runnable MVP where daily outfit generation reliably references the user's light closet and feedback can influence the next recommendation.

**Architecture:** Keep the current native WeChat mini-program plus Node backend shape. Add a small light-closet domain layer, a fixed tag dictionary, and a recommendation brief builder that turns user profile, weather, scene, and closet items into a structured `outfitBrief` consumed by image generation. This plan intentionally does not change the current public file-server requirement for body-scan uploads and does not remove full debug logging, because both are still needed for current Image2 integration and debugging.

**Tech Stack:** WeChat mini-program JavaScript/WXML/WXSS, Node.js HTTP backend, JSON runtime stores, existing moxing image provider, existing asset store.

**Execution status:** Implemented on 2026-06-04. Scope locks were respected: the body-scan public file-server requirement was not changed, and full debug logging was left enabled for current Image2 debugging. Verification covered Node syntax checks, stale-doc reference checks, current-source API smoke tests for closet usage and force-new regeneration, and ready-state quota consumption.

---

## Scope Locks

Do not implement these in this plan:

- Do not add a local fallback for `body_scan` public file-server upload. Production Image2 calls currently require public image URLs.
- Do not remove or redact full debug prompt/provider logs yet. They remain useful during current image-generation debugging.
- Do not build full wardrobe management, ecommerce recommendations, community, style reports, or open-ended chat.

Implement these:

- Fix generation quota so failed or incomplete generation attempts do not consume quota.
- Ensure explicit regeneration creates a fresh image job.
- Define the light closet data contract and tag dictionary.
- Normalize light closet items to internal enum keys plus Chinese labels.
- Build an MVP outfit brief that uses at least one user closet item when possible.
- Include closet usage in `promptContract`, prompt text, API output, and detail page copy.
- Persist simple feedback signals so the next recommendation can avoid rejected style tags.
- Fix stale docs that reference the deleted `docs/IMAGE_TASK_PROTOCOL.md`.

---

## File Structure

- Create: `backend/light-closet-tags.js`
  - Owns fixed enum dictionaries and label lookup for category, color, scene, style, body strategy, and risk tags.

- Create: `backend/light-closet.js`
  - Owns normalization of closet items, closet scoring, item selection, and feedback preference updates.

- Modify: `data/mock.js`
  - Upgrade mock closet items to the light-closet schema with internal keys and Chinese labels.

- Modify: `backend/server.js`
  - Use light closet selection in generation payloads.
  - Extend prompt contract and prompt text with used closet items.
  - Fix quota deduction timing.
  - Add a fresh-job path for explicit regeneration.
  - Return source/closet usage to frontend.
  - Persist feedback preference signals.

- Modify: `services/mock-server.js`
  - Mirror quota and light-closet behavior for mock mode so local testing and real backend semantics stay aligned.

- Modify: `services/api.js`
  - Pass `forceNew` for explicit regenerate calls.

- Modify: `pages/home/home.js`
  - Send `forceNew: true` when the user taps regenerate.
  - Preserve scene switching behavior.

- Modify: `pages/home/home.wxml`
  - Show concise closet-source copy on the home card.

- Modify: `pages/daily/daily.wxml`
  - Show which user closet items were used and which trend slots filled gaps.

- Modify: `pages/daily/daily.js`
  - Include low-score reason payload when possible.

- Modify: `docs/API.md`
  - Replace deleted image task protocol reference with current generation contract docs.
  - Document `usedClosetItems`, `trendFillSlots`, and `forceNew`.

- Modify: `docs/PRODUCT_V1_3_ADDENDUM.md`
  - Remove stale `docs/IMAGE_TASK_PROTOCOL.md` reference.

---

### Task 1: Add Light Closet Tag Dictionary

**Files:**
- Create: `backend/light-closet-tags.js`

- [ ] **Step 1: Write the dictionary module**

Create `backend/light-closet-tags.js`:

```js
const dictionaries = {
  category: {
    outerwear: "外套",
    top: "上衣",
    bottom: "下装",
    dress: "连衣裙",
    shoes: "鞋",
    bag: "包",
    accessory: "配饰"
  },
  scene: {
    office: "上班",
    dating: "约会",
    party: "聚会",
    travel: "出游",
    shopping: "逛街",
    daily: "日常"
  },
  color: {
    cream_white: "奶油白",
    mist_blue: "雾蓝",
    sage_green: "鼠尾草绿",
    denim_blue: "牛仔蓝",
    dark_indigo: "深靛蓝",
    black: "黑色",
    beige: "米色",
    grey: "灰色",
    blush_pink: "豆沙粉"
  },
  style: {
    clean_fit: "干净感",
    commute: "通勤",
    korean: "韩系",
    minimal: "极简",
    light_mature: "轻熟",
    relaxed: "松弛感",
    sweet_light: "轻甜"
  },
  bodyStrategy: {
    define_shoulder: "补肩线",
    raise_waistline: "提高腰线",
    extend_leg: "拉长腿部比例",
    petite_extend: "小个子显高",
    light_shoes: "轻量鞋",
    upper_focus: "上半身做重点",
    smooth_bottom: "下装保持垂顺",
    open_neckline: "打开领口",
    vertical_line: "增加纵向线条"
  },
  risk: {
    press_height: "压身高",
    widen_hip: "显胯宽",
    too_mature: "偏成熟",
    too_sweet: "偏甜",
    too_heavy: "偏厚重"
  }
};

function labelFor(type, key) {
  return (dictionaries[type] && dictionaries[type][key]) || String(key || "");
}

function labelsFor(type, keys = []) {
  return (Array.isArray(keys) ? keys : [])
    .map((key) => labelFor(type, key))
    .filter(Boolean);
}

function knownKeys(type) {
  return Object.keys(dictionaries[type] || {});
}

module.exports = {
  dictionaries,
  labelFor,
  labelsFor,
  knownKeys
};
```

- [ ] **Step 2: Verify syntax**

Run: `node --check backend/light-closet-tags.js`

Expected: no output and exit code 0.

- [ ] **Step 3: Commit**

```bash
git add backend/light-closet-tags.js
git commit -m "feat: add light closet tag dictionary"
```

---

### Task 2: Add Light Closet Selection Domain

**Files:**
- Create: `backend/light-closet.js`

- [ ] **Step 1: Write the selection module**

Create `backend/light-closet.js`:

```js
const tags = require("./light-closet-tags");

const sceneMap = {
  "上班": "office",
  "约会": "dating",
  "聚会": "party",
  "出游": "travel",
  "逛街": "shopping",
  "日常": "daily"
};

function sceneKey(scene) {
  return sceneMap[scene] || scene || "daily";
}

function ensureArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeClosetItem(item = {}) {
  const category = item.category || "top";
  const sceneTags = ensureArray(item.sceneTags);
  const styleTags = ensureArray(item.styleTags || item.tags);
  const bodyStrategyTags = ensureArray(item.bodyStrategyTags);
  const riskTags = ensureArray(item.riskTags);
  const color = item.colorKey || item.color || "";

  return {
    ...item,
    itemId: item.itemId || item.id || `closet-${Date.now()}`,
    id: item.id || item.itemId || `closet-${Date.now()}`,
    category,
    categoryLabel: item.categoryLabel || tags.labelFor("category", category),
    subCategory: item.subCategory || item.sub_category || "",
    subCategoryLabel: item.subCategoryLabel || item.name || "",
    color,
    colorLabel: item.colorLabel || tags.labelFor("color", color) || item.color || "",
    sceneTags,
    sceneLabels: item.sceneLabels || tags.labelsFor("scene", sceneTags),
    styleTags,
    styleLabels: item.styleLabels || tags.labelsFor("style", styleTags),
    bodyStrategyTags,
    bodyStrategyLabels: item.bodyStrategyLabels || tags.labelsFor("bodyStrategy", bodyStrategyTags),
    riskTags,
    riskLabels: item.riskLabels || tags.labelsFor("risk", riskTags),
    usageCount: Number(item.usageCount || 0)
  };
}

function normalizeCloset(items = []) {
  return ensureArray(items).map(normalizeClosetItem);
}

function scoreItem(item, context = {}) {
  const scene = sceneKey(context.scene);
  const bodyStrategies = ensureArray(context.bodyStrategies);
  const favoriteColors = ensureArray(context.favoriteColors);
  const rejectedStyleTags = ensureArray(context.rejectedStyleTags);

  let score = 0;
  if (item.sceneTags.includes(scene)) score += 4;
  if (favoriteColors.includes(item.color) || favoriteColors.includes(item.colorLabel)) score += 2;
  score += item.bodyStrategyTags.filter((tag) => bodyStrategies.includes(tag)).length * 3;
  score += item.styleTags.filter((tag) => rejectedStyleTags.includes(tag)).length * -4;
  score += item.riskTags.length * -2;
  score += Math.max(0, 2 - item.usageCount) * 0.5;
  return score;
}

function pickClosetItems(items = [], context = {}) {
  const normalized = normalizeCloset(items);
  const ranked = normalized
    .map((item) => ({ item, score: scoreItem(item, context) }))
    .sort((left, right) => right.score - left.score);
  const required = ranked.filter((entry) => entry.score > 0).slice(0, 2).map((entry) => entry.item);
  const fallback = ranked.slice(0, 1).map((entry) => entry.item);
  const picked = required.length ? required : fallback;

  return {
    usedClosetItems: picked,
    usedClosetItemIds: picked.map((item) => item.itemId),
    usedClosetItemLabels: picked.map((item) => item.name || item.subCategoryLabel || item.categoryLabel),
    trendFillSlots: inferTrendFillSlots(picked),
    sourceMix: picked.length ? ["wardrobe", "trend_library"] : ["trend_library"]
  };
}

function inferTrendFillSlots(items = []) {
  const categories = new Set(items.map((item) => item.category));
  const missing = [];
  if (!categories.has("top")) missing.push("内搭");
  if (!categories.has("bottom") && !categories.has("dress")) missing.push("下装");
  if (!categories.has("shoes")) missing.push("鞋");
  return missing.slice(0, 2);
}

function updatePreferenceFromRating(user = {}, rating = {}) {
  const scores = rating.scores || {};
  const rejectedStyleTags = new Set(user.rejectedStyleTags || []);
  if (Number(scores.fashion || 0) <= 2 || Number(scores.wearable || 0) <= 2) {
    ensureArray(rating.styleTags).forEach((tag) => rejectedStyleTags.add(tag));
  }
  return {
    ...user,
    rejectedStyleTags: Array.from(rejectedStyleTags)
  };
}

module.exports = {
  sceneKey,
  normalizeClosetItem,
  normalizeCloset,
  pickClosetItems,
  updatePreferenceFromRating
};
```

- [ ] **Step 2: Verify syntax**

Run: `node --check backend/light-closet.js`

Expected: no output and exit code 0.

- [ ] **Step 3: Commit**

```bash
git add backend/light-closet.js
git commit -m "feat: add light closet selection"
```

---

### Task 3: Upgrade Mock Closet Data to the Contract

**Files:**
- Modify: `data/mock.js`

- [ ] **Step 1: Update closet items**

Replace the existing `const closet = [...]` entries with items that include enum keys plus Chinese labels. Keep the same visible item names.

Example shape for each item:

```js
{
  id: "c1",
  itemId: "c1",
  name: "短款奶油白西装",
  category: "outerwear",
  categoryLabel: "外套",
  subCategory: "short_blazer",
  subCategoryLabel: "短款西装",
  color: "cream_white",
  colorLabel: "奶油白",
  warmth: 2,
  formality: 4,
  sourceType: "wardrobe",
  sceneTags: ["office", "dating"],
  sceneLabels: ["上班", "约会"],
  styleTags: ["clean_fit", "commute"],
  styleLabels: ["干净感", "通勤"],
  bodyStrategyTags: ["define_shoulder", "raise_waistline"],
  bodyStrategyLabels: ["补肩线", "提高腰线"],
  riskTags: [],
  riskLabels: [],
  usageCount: 0,
  image: ""
}
```

- [ ] **Step 2: Verify syntax**

Run: `node --check data/mock.js`

Expected: no output and exit code 0.

- [ ] **Step 3: Commit**

```bash
git add data/mock.js
git commit -m "chore: normalize mock closet tags"
```

---

### Task 4: Fix Quota Deduction Timing

**Files:**
- Modify: `backend/server.js`
- Modify: `services/mock-server.js`

- [ ] **Step 1: Move backend quota increment to ready success**

In `backend/server.js`, remove these lines from `POST /api/outfits/generate`:

```js
state.generationUsed += 1;
persistRuntimeState();
```

Add a helper near `quota()`:

```js
function consumeGenerationQuotaOnce(job) {
  if (!job || job.quotaConsumed) return;
  state.generationUsed += 1;
  persistRuntimeState();
  imageTaskStore.updateJob(job.id, { quotaConsumed: true });
}
```

Call it only when the public job is ready:

```js
if (job && job.status === "ready") {
  consumeGenerationQuotaOnce(job);
}
```

Place the call after `submitPendingImageJob` or after poll/download updates where a job becomes `ready`.

- [ ] **Step 2: Add quotaConsumed field to jobs**

In `backend/image-task-store.js`, add the default:

```js
quotaConsumed: Boolean(payload.quotaConsumed),
```

inside the `job` object created by `createJob`.

- [ ] **Step 3: Mirror mock behavior**

In `services/mock-server.js`, keep mock generation simple but only increment after the mock payload is built as a successful result:

```js
const generated = withGenerationMeta(outfit, scene);
state.generationUsed += 1;
return wait({
  ...generated,
  quota: quota()
}, 700);
```

- [ ] **Step 4: Verify syntax**

Run:

```bash
node --check backend/server.js
node --check backend/image-task-store.js
node --check services/mock-server.js
```

Expected: all commands produce no output and exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/server.js backend/image-task-store.js services/mock-server.js
git commit -m "fix: consume generation quota only on success"
```

---

### Task 5: Make Explicit Regenerate Create a Fresh Job

**Files:**
- Modify: `backend/server.js`
- Modify: `services/api.js`
- Modify: `pages/home/home.js`

- [ ] **Step 1: Add force-new support to backend job creation**

Change `ensureImageJob(userId, scene)` to accept an options object:

```js
function ensureImageJob(userId, scene, options = {}) {
  const payload = imageJobPayload(userId, scene);
  if (!options.forceNew) {
    const existing = imageTaskStore.listJobs().find((item) =>
      item.id === payload.targetPath.split("/").pop().replace(/\.(png|jpg|jpeg)$/i, "")
      || item.id === `${userId}-${scene}`
    );
    if (existing) return existing;
  }
  const manual = mock.manualImageJobs.find((item) => item.userId === userId && item.scene === scene);
  return imageTaskStore.createJob({
    ...payload,
    id: options.forceNew ? undefined : (manual ? manual.id : undefined),
    source: options.forceNew ? "outfit_regenerate" : "outfit_generate"
  });
}
```

In the generate endpoint, pass:

```js
let job = ensureImageJob(targetUserId, scene, { forceNew: Boolean(body.forceNew) });
```

- [ ] **Step 2: Pass forceNew from API layer**

No signature change is needed in `services/api.js` if it already passes payload through. Confirm `generateOutfit(payload)` sends the full payload.

- [ ] **Step 3: Send forceNew only for regenerate**

In `pages/home/home.js`, change:

```js
this.generateForScene(this.data.activeScene);
```

inside `regenerate()` to:

```js
this.generateForScene(this.data.activeScene, { forceNew: true });
```

Change `generateForScene` signature:

```js
async generateForScene(scene = this.data.activeScene, options = {}) {
```

Change request payload:

```js
const outfit = await api.generateOutfit({ scene, forceNew: Boolean(options.forceNew) });
```

- [ ] **Step 4: Verify syntax**

Run:

```bash
node --check backend/server.js
node --check pages/home/home.js
```

Expected: no output and exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/server.js pages/home/home.js
git commit -m "fix: create fresh jobs for explicit regeneration"
```

---

### Task 6: Build Outfit Brief From Light Closet

**Files:**
- Modify: `backend/server.js`
- Modify: `services/mock-server.js`

- [ ] **Step 1: Import light closet module**

At the top of `backend/server.js`:

```js
const lightCloset = require("./light-closet");
```

- [ ] **Step 2: Add brief builder**

Near `imageJobPayload`, add:

```js
function outfitBriefFor(user, profile, scene, outfit) {
  const closetPick = lightCloset.pickClosetItems(mock.closet, {
    scene,
    bodyStrategies: profile.strategyTags || profile.stylingStrategies || [],
    favoriteColors: user.favoriteColors || [],
    rejectedStyleTags: user.rejectedStyleTags || []
  });
  return {
    scene,
    mood: outfit.displayMood || outfit.mood || "",
    title: outfit.displayTitle || outfit.title || "",
    usedClosetItems: closetPick.usedClosetItems,
    usedClosetItemIds: closetPick.usedClosetItemIds,
    usedClosetItemLabels: closetPick.usedClosetItemLabels,
    trendFillSlots: closetPick.trendFillSlots,
    sourceMix: closetPick.sourceMix,
    closetUsageCopy: closetPick.usedClosetItemLabels.length
      ? `今天用了你衣橱里的${closetPick.usedClosetItemLabels.join("、")}。`
      : "今天先用趋势库搭一版，上传常穿衣服后会更像你的日常。"
  };
}
```

- [ ] **Step 3: Attach brief to generation payloads**

In `generationPayload`, after `const outfit = outfitWithAsset(...)`, compute:

```js
const currentUser = state.users.find((item) => item.id === userId) || activeUser();
const brief = outfitBriefFor(currentUser, mergeBodyProfile(currentUser.bodyProfile || mock.bodyProfile, {}), scene, outfit);
```

Add to `payload`:

```js
outfitBrief: brief,
usedClosetItems: brief.usedClosetItems,
usedClosetItemIds: brief.usedClosetItemIds,
usedClosetItemLabels: brief.usedClosetItemLabels,
trendFillSlots: brief.trendFillSlots,
sourceMix: brief.sourceMix,
closetUsageCopy: brief.closetUsageCopy,
```

- [ ] **Step 4: Mirror in mock server**

In `services/mock-server.js`, add equivalent simple `outfitBriefFor` using `mock.closet` and attach the same fields in `withGenerationMeta`.

- [ ] **Step 5: Verify syntax**

Run:

```bash
node --check backend/server.js
node --check services/mock-server.js
```

Expected: no output and exit 0.

- [ ] **Step 6: Commit**

```bash
git add backend/server.js services/mock-server.js
git commit -m "feat: build outfit briefs from light closet"
```

---

### Task 7: Extend Prompt Contract With Closet Usage

**Files:**
- Modify: `backend/server.js`
- Modify: `docs/IMAGE_GENERATION_CONTRACT.md`

- [ ] **Step 1: Add closet fields to contract**

In `buildPromptContract`, compute the brief:

```js
const brief = outfitBriefFor(user, profile, scene, outfit);
```

Add fields:

```js
usedClosetItemIds: brief.usedClosetItemIds,
usedClosetItemLabels: brief.usedClosetItemLabels,
trendFillSlots: brief.trendFillSlots,
sourceMix: brief.sourceMix,
```

- [ ] **Step 2: Add closet usage to prompt text**

In `buildImagePrompt`, add:

```js
const brief = outfitBriefFor(user, profile, scene, outfit);
const closetText = brief.usedClosetItemLabels.length
  ? `本次必须参考并使用用户衣橱里的这些单品：${brief.usedClosetItemLabels.join("、")}。`
  : "用户衣橱暂无可用单品，本次使用趋势库生成参考穿搭。";
```

Insert `closetText` before the image requirements line.

- [ ] **Step 3: Document new contract fields**

In `docs/IMAGE_GENERATION_CONTRACT.md`, add rows:

```markdown
| `usedClosetItemIds` | 本次推荐引用的用户衣橱单品 ID |
| `usedClosetItemLabels` | 本次推荐引用的用户衣橱单品中文名 |
| `trendFillSlots` | 用户衣橱不足时由趋势库补位的槽位 |
| `sourceMix` | 本次推荐来源组合，如 `wardrobe`、`trend_library` |
```

- [ ] **Step 4: Verify syntax**

Run: `node --check backend/server.js`

Expected: no output and exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/server.js docs/IMAGE_GENERATION_CONTRACT.md
git commit -m "feat: include closet usage in image contract"
```

---

### Task 8: Show Closet Usage in Home and Daily Detail

**Files:**
- Modify: `pages/home/home.wxml`
- Modify: `pages/daily/daily.wxml`
- Modify: `pages/daily/daily.js`

- [ ] **Step 1: Add home source copy**

In `pages/home/home.wxml`, near the outfit title/mood block, add:

```xml
<view wx:if="{{outfit.closetUsageCopy}}" class="closet-source">{{outfit.closetUsageCopy}}</view>
```

Add minimal style to existing home WXSS:

```css
.closet-source {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: rgba(74, 49, 42, 0.72);
}
```

- [ ] **Step 2: Add detail source section**

In `pages/daily/daily.wxml`, before the layer list, add:

```xml
<view wx:if="{{outfit.usedClosetItemLabels && outfit.usedClosetItemLabels.length}}" class="detail-section">
  <view class="section-title">用了你的衣服</view>
  <view class="subtitle">{{outfit.usedClosetItemLabels.join('、')}}</view>
</view>
<view wx:if="{{outfit.trendFillSlots && outfit.trendFillSlots.length}}" class="detail-section">
  <view class="section-title">趋势库补位</view>
  <view class="subtitle">{{outfit.trendFillSlots.join('、')}}</view>
</view>
```

- [ ] **Step 3: Verify mini-program expression support**

If WXML does not accept `.join()`, compute strings in `pages/daily/daily.js` after loading outfit:

```js
const nextOutfit = {
  ...outfit,
  usedClosetItemsText: (outfit.usedClosetItemLabels || []).join("、"),
  trendFillSlotsText: (outfit.trendFillSlots || []).join("、")
};
```

Then bind `{{outfit.usedClosetItemsText}}` and `{{outfit.trendFillSlotsText}}`.

- [ ] **Step 4: Verify syntax**

Run: `node --check pages/daily/daily.js`

Expected: no output and exit 0.

- [ ] **Step 5: Commit**

```bash
git add pages/home/home.wxml pages/home/home.wxss pages/daily/daily.wxml pages/daily/daily.js
git commit -m "feat: show closet usage in outfit pages"
```

---

### Task 9: Persist Simple Feedback Signals

**Files:**
- Modify: `backend/server.js`
- Modify: `services/mock-server.js`

- [ ] **Step 1: Update backend rating endpoint**

In `POST /api/outfits/:id/rating`, after creating `rating`, update active user:

```js
const currentUser = activeUser();
const updatedUser = lightCloset.updatePreferenceFromRating(currentUser, {
  ...rating,
  styleTags: (state.generations[body.generationId] && state.generations[body.generationId].styleTags) || []
});
Object.assign(currentUser, updatedUser);
persistRuntimeState();
```

- [ ] **Step 2: Return preference update summary**

Return:

```js
sendJson(res, 200, ok({
  saved: true,
  rating,
  fashionProfileUpdate: {
    rejectedStyleTags: currentUser.rejectedStyleTags || []
  }
}));
```

- [ ] **Step 3: Mirror in mock server**

In `services/mock-server.js`, add a simple `rejectedStyleTags` update when `wearable <= 2` or `fashion <= 2`.

- [ ] **Step 4: Verify syntax**

Run:

```bash
node --check backend/server.js
node --check services/mock-server.js
```

Expected: no output and exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/server.js services/mock-server.js
git commit -m "feat: persist outfit feedback signals"
```

---

### Task 10: Fix Stale Documentation References

**Files:**
- Modify: `docs/API.md`
- Modify: `docs/PRODUCT_V1_3_ADDENDUM.md`

- [ ] **Step 1: Replace deleted protocol doc references**

In both docs, replace:

```text
docs/IMAGE_TASK_PROTOCOL.md
```

with:

```text
docs/IMAGE_GENERATION_CONTRACT.md
docs/MINIPROGRAM_MULTIPLATFORM_LIMITS.md
```

- [ ] **Step 2: Add light closet API fields**

In `docs/API.md`, document these response fields for outfit generation and daily outfit detail:

```markdown
- `usedClosetItems`：本次引用的轻衣橱单品对象
- `usedClosetItemIds`：本次引用的轻衣橱单品 ID
- `usedClosetItemLabels`：本次引用的轻衣橱单品中文名
- `trendFillSlots`：趋势库补位槽位
- `sourceMix`：来源组合
- `closetUsageCopy`：前端可直接展示的来源说明
```

Document request field:

```markdown
- `forceNew`：布尔值，用户主动重新生成时传 `true`，后端必须创建新任务
```

- [ ] **Step 3: Commit**

```bash
git add docs/API.md docs/PRODUCT_V1_3_ADDENDUM.md
git commit -m "docs: update image and closet API references"
```

---

### Task 11: End-to-End Verification

**Files:**
- No source edits unless verification exposes a defect.

- [ ] **Step 1: Run syntax checks**

Run:

```bash
node --check backend/server.js
node --check backend/light-closet.js
node --check backend/light-closet-tags.js
node --check backend/image-task-store.js
node --check services/mock-server.js
node --check services/api.js
node --check pages/home/home.js
node --check pages/daily/daily.js
```

Expected: all commands exit 0.

- [ ] **Step 2: Start backend**

Run: `cd backend && npm run dev`

Expected: server prints `Guimi mock API listening on port 8787`.

- [ ] **Step 3: Verify health**

Run: `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8787/api/health`

Expected: JSON payload with `code: 0`.

- [ ] **Step 4: Verify home response includes closet fields**

Run: `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8787/api/home`

Expected: `dailyOutfit` contains `closetUsageCopy` after a generated or daily payload is returned. If `/api/home` only returns existing manual asset data, call generation in Step 5.

- [ ] **Step 5: Verify generation includes closet fields**

Run:

```powershell
Invoke-WebRequest -UseBasicParsing `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"scene":"上班","forceNew":true}' `
  http://127.0.0.1:8787/api/outfits/generate
```

Expected response data includes:

- `usedClosetItemLabels`
- `trendFillSlots`
- `sourceMix`
- `promptContract.usedClosetItemLabels` stored in the corresponding image job
- quota is consumed only if the returned image job is `ready`

- [ ] **Step 6: Verify regenerate creates a new job**

Run Step 5 twice with `forceNew:true`.

Expected: two different `imageJob.id` values.

- [ ] **Step 7: Verify failed/incomplete does not consume quota**

Temporarily run without `MOXING_API_KEY` in a local shell or create an incomplete contract through an existing debug endpoint.

Expected: `quota.used` does not increase when `imageJob.status` is not `ready`.

- [ ] **Step 8: Verify docs no longer reference deleted protocol**

Run: `rg -n "IMAGE_TASK_PROTOCOL" docs`

Expected: no matches.

- [ ] **Step 9: Commit final verification fixes**

If verification required small fixes:

```bash
git add <changed-files>
git commit -m "fix: complete light closet mvp verification"
```

---

## Self-Review

- Spec coverage: This plan covers quota correctness, regeneration freshness, light closet schema, closet-driven outfit brief, prompt contract extension, UI source disclosure, feedback persistence, and stale docs. It explicitly excludes body-scan public upload fallback and debug log redaction per product decision.
- Placeholder scan: No `TBD`, `TODO`, or unspecified implementation steps remain.
- Type consistency: The plan consistently uses `usedClosetItems`, `usedClosetItemIds`, `usedClosetItemLabels`, `trendFillSlots`, `sourceMix`, `closetUsageCopy`, and `forceNew`.

---

## Execution Options

Plan complete and saved to `docs/superpowers/plans/2026-06-04-light-closet-mvp.md`. Two execution options:

1. Subagent-Driven (recommended) - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. Inline Execution - execute tasks in this session using executing-plans, batch execution with checkpoints.
