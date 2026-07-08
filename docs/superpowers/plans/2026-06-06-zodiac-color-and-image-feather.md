# Zodiac Color And Image Feather Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add soft homepage image edge blending and replace ad hoc lucky color selection with a deterministic local zodiac color knowledge base.

**Architecture:** Store zodiac color knowledge in `data/zodiac-lucky-colors.js`, expose a deterministic helper, and use it from backend and mock API aura builders. Add visual feathering in the homepage stage with CSS pseudo-elements/overlay views so generated images blend into the warm studio.

**Tech Stack:** WeChat mini-program WXML/WXSS, Node.js CommonJS backend data modules.

---

### Task 1: Local Zodiac Color Knowledge

**Files:**
- Create: `data/zodiac-lucky-colors.js`
- Modify: `backend/server.js`
- Modify: `services/mock-server.js`

- [ ] Add a CommonJS module exporting `luckyColorForZodiac(zodiac, date)`.
- [ ] Use a stable date seed so the same zodiac gets one color per calendar day.
- [ ] Return Chinese fields: `color`, `hex`, `part`, `stylingHint`, `source`.
- [ ] Replace backend/mock aura lucky color fallback with this helper.

### Task 2: Homepage Image Feathering

**Files:**
- Modify: `pages/home/home.wxml`
- Modify: `pages/home/home.wxss`

- [ ] Add a visual overlay inside `.editorial-stage` above the image.
- [ ] Use radial/linear gradients around edges only.
- [ ] Keep the model image sharp by not blurring the image element itself.

### Task 3: Verification

**Commands:**
- `node --check data/zodiac-lucky-colors.js`
- `node --check backend/server.js`
- `node --check services/mock-server.js`
- `node --check pages/home/home.js`
- Static assertions for `luckyColorForZodiac`, `image-feather`, and aura source fields.
