# Home Studio Photo Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the home page generated-image presentation so the model image stays clear, text does not cover the face, and image2 stops being asked for transparent PNG/checkerboard-prone output.

**Architecture:** Change image generation from transparent cutout semantics to a complete warm-white studio fashion photo. Update the home hero to treat the generated image as a framed editorial photo area instead of a transparent model layer, and move annotations away from the face/body.

**Tech Stack:** WeChat mini-program WXML/WXSS/JavaScript, Node.js prompt builder.

---

## Scope Locks

- Do not change body-scan upload or public file-server behavior.
- Do not remove current debug logs.
- Do not add background-removal/image post-processing in this pass.
- Do not change tab structure again.

## Tasks

### Task 1: Prompt Direction

**Files:**
- Modify: `backend/server.js`

- [ ] Replace transparent PNG requirements in `buildImagePrompt` with warm-white studio-photo requirements.
- [ ] Verify backend syntax with `node --check backend\server.js`.

### Task 2: Home Hero Structure

**Files:**
- Modify: `pages/home/home.wxml`
- Modify: `pages/home/home.wxss`

- [ ] Wrap the generated image in a dedicated `editorial-stage` image frame.
- [ ] Remove top-of-image veil/softening layers that blur the face.
- [ ] Move title and metadata to left editorial column and keep it under the top chips.
- [ ] Remove right-side body tags from over the model.
- [ ] Move proportion/color/scene reasons into a bottom-left reason block that does not overlap the face.
- [ ] Reduce `MILI.` so it stays behind the layout and does not cover feet/legs.

### Task 3: Verification

**Files:**
- Verify changed files.

- [ ] Run `node --check backend\server.js`.
- [ ] Run `node --check pages\home\home.js`.
- [ ] Search for prompt constraints and new layout markers.
- [ ] Tell user to test in WeChat DevTools with a fresh image2 generation.

