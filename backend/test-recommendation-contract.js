const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "backend", "server.js"), "utf8");
const home = fs.readFileSync(path.join(root, "pages", "home", "home.js"), "utf8");
const provider = fs.readFileSync(path.join(root, "backend", "providers", "moxing-image.js"), "utf8");
const providerChain = fs.readFileSync(path.join(root, "backend", "provider-chain.js"), "utf8");
const recommendationService = fs.readFileSync(path.join(root, "backend", "recommendation-service.js"), "utf8");
const imageGenerationService = fs.readFileSync(path.join(root, "backend", "image-generation-service.js"), "utf8");
const mvpDebugService = fs.readFileSync(path.join(root, "backend", "mvp-debug-service.js"), "utf8");

function assertIncludes(source, needle, message) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

assertIncludes(server, "function recommendationSnapshotFor", "server must build one recommendation snapshot");
assertIncludes(server, "recommendationSnapshot:", "server payloads must return the recommendation snapshot");
assertIncludes(server, "recommendationStore.createRecommendation", "server must persist recommendation records");
assertIncludes(server, "recommendationId", "server must connect recommendations with image jobs");
assertIncludes(server, "stylingNotes", "server must return concise styling notes from recommendation snapshot");
assertIncludes(server, "RECOMMENDATION_STYLIST_PROMPT", "server must keep a recommendation stylist prompt");
assertIncludes(server, "你是一位专业时尚穿搭顾问", "recommendation stylist prompt must use approved role text");
assertIncludes(server, "closetReferenceImages", "server must convert selected closet item images into references");
assertIncludes(server, "selectedClosetReferences", "server must reserve Image2 reference slots for closet item images");
assertIncludes(server, "reference_images: referenceImageInputsList", "Image2 request must receive resolved reference images");
assertIncludes(server, "closetReferenceImageCount", "prompt contract must expose closet reference image count");
assertIncludes(server, "recommendationService.recommendOutfit", "server must use the recommendation service as the model/fallback entry");
assertIncludes(server, "imageGenerationService.submitImage", "server must use the image generation service as the provider/fallback entry");
assertIncludes(server, "/api/debug/mvp-readiness", "server must expose an MVP readiness debug endpoint");
assertIncludes(server, "providerAttempts: job.providerAttempts", "public image jobs must expose provider attempts for debugging");
assertIncludes(server, "createdAt: job.createdAt", "public image jobs must expose createdAt for record ordering");
assertIncludes(server, "uploadStatus", "closet upload responses must expose upload and cloud analysis status");
assertIncludes(server, "plain photography output", "image prompt must ask for plain photography instead of magazine layout");
assertIncludes(server, "Outfit reasons are shown by the app UI outside the image", "image prompt must keep reasons outside the generated image");
assertIncludes(home, "recommendationSnapshot", "home page must prefer recommendation snapshot fields");
assertIncludes(home, "recommendationId", "home page ratings must send recommendationId when available");
assertIncludes(provider, "input_mode: \"multi_image\"", "provider must support multi-image reference mode");
assertIncludes(providerChain, "runProviderChain", "provider chain must expose one fallback runner");
assertIncludes(providerChain, "all providers failed", "provider chain must preserve failure attempts when every provider fails");
assertIncludes(recommendationService, "local_recommendation", "recommendation service must keep the local recommendation fallback provider");
assertIncludes(imageGenerationService, "moxing", "image generation service must wrap the current moxing provider");
assertIncludes(mvpDebugService, "buildMvpReadinessReport", "MVP debug service must build a readiness report");
assertIncludes(mvpDebugService, "closet_items_missing_public_image_url", "MVP debug service must surface missing public image URLs");

const buildPromptStart = server.indexOf("function buildImagePrompt");
const buildPromptEnd = server.indexOf("function buildPromptContract");
const buildPromptSource = server.slice(buildPromptStart, buildPromptEnd);
if (/const\s+reasons\s*=/.test(buildPromptSource) || /summaryReasons/.test(buildPromptSource)) {
  throw new Error("image prompt must not pass outfit reasons into the image model");
}
if (/专业时尚穿搭顾问|互联网信息补位/.test(buildPromptSource)) {
  throw new Error("recommendation stylist prompt must not be included in image prompt");
}

console.log("recommendation contract static checks passed");
