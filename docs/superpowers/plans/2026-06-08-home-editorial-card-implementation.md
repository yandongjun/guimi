# Home Editorial Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the homepage to the approved editorial-card layout so the model image stays clear and all explanatory copy lives in page UI.

**Architecture:** Keep existing data contracts, but add a front-end compact title helper and move explanation content into a bottom card. Update the image prompt and negative prompt so generated images do not include text, arrows, labels, or poster UI.

**Tech Stack:** WeChat Mini Program WXML/WXSS/JS, Node backend prompt builder, existing plain Node tests.

---

### Task 1: Add Front-End Editorial Presentation Helpers

**Files:**
- Modify: `pages/home/home.js`

- [ ] Add `compactTitleLines` and `editorialSummary` in `prepareHomeOutfit`.
- [ ] Keep `closetSourceText` derived from `usedClosetItemLabels`.
- [ ] Verify title lines are at most two short strings.

### Task 2: Replace Old Cover Information Layout

**Files:**
- Modify: `pages/home/home.wxml`

- [ ] Remove `reason-stack` and right-side `tag` overlays from the main model area.
- [ ] Render a compact left title.
- [ ] Render a bottom `editorial-card` with mood, closet source, three reasons, palette, and actions.

### Task 3: Restyle Cover for Model Clarity

**Files:**
- Modify: `pages/home/home.wxss`

- [ ] Move the model into the right-side studio area.
- [ ] Reduce `model-veil` and `photo-soften` opacity so faces and clothing remain clear.
- [ ] Add `editorial-card` styles.
- [ ] Shrink title size and constrain it away from face/chest.

### Task 4: Prevent Generated Text in Image Prompt

**Files:**
- Modify: `backend/server.js`

- [ ] Add explicit prompt lines requiring clean fashion try-on photography without text.
- [ ] Add negative prompt terms for no typography, captions, labels, arrows, numbers, and UI elements.

### Task 5: Verify

**Commands:**
- `node --check backend/server.js`
- `node --check backend/providers/moxing-image.js`
- `node backend/test-recommendation-contract.js`

**Manual check:**
- Open WeChat simulator homepage.
- Confirm title no longer covers face or chest.
- Confirm old right-side tags are gone.
- Generate a new image and confirm image prompt no longer asks for annotations.
