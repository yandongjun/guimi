function byUpdatedDesc(left = {}, right = {}) {
  return String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || ""));
}

function hasPublicImageUrl(item = {}) {
  return /^https?:\/\//i.test(String(item.publicImageUrl || item.remoteImageUrl || item.sourceImageUrl || ""));
}

function latestJob(imageJobs = []) {
  return [...(imageJobs || [])].sort(byUpdatedDesc)[0] || null;
}

function findRecommendation(recommendations = [], id = "") {
  if (!id) return null;
  return (recommendations || []).find((item) => item.id === id) || null;
}

function summarizeGeneration({ imageJobs = [], publicImageJobs = [], recommendations = [] } = {}) {
  const latest = latestJob(imageJobs);
  const publicLatest = latest
    ? (publicImageJobs || []).find((item) => item.id === latest.id) || null
    : null;
  const recommendationId = latest && (latest.recommendationId || latest.recommendationSnapshot?.recommendationId || "");
  const recommendation = findRecommendation(recommendations, recommendationId);
  const publicImageUrl = publicLatest?.imageUrl || latest?.imageUrl || "";

  return {
    totalJobs: imageJobs.length,
    readyJobs: imageJobs.filter((item) => item.status === "ready" && (item.imageUrl || publicImageJobs.find((job) => job.id === item.id && job.imageUrl))).length,
    latestJobId: latest?.id || "",
    latestStatus: latest?.status || "",
    hasImage: Boolean(publicImageUrl),
    publicImageUrl,
    recommendationId: recommendationId || "",
    recommendationLinked: Boolean(recommendation),
    recordVisible: Boolean(publicLatest && publicLatest.id),
    selectedItemIds: latest?.usedClosetItemIds || publicLatest?.usedClosetItemIds || [],
    selectedItemLabels: latest?.usedClosetItemLabels || publicLatest?.usedClosetItemLabels || [],
    provider: latest?.provider || "",
    providerAttempts: latest?.providerAttempts || [],
    localizeStatus: latest?.localizeStatus || publicLatest?.localizeStatus || "",
    lastError: latest?.errorMessage || publicLatest?.errorMessage || latest?.localizeError || ""
  };
}

function summarizeRecommendations(recommendations = []) {
  return {
    total: recommendations.length,
    imageBound: recommendations.filter((item) => item.imageJobId || item.generatedImageUrl).length,
    feedbackCount: recommendations.filter((item) => item.feedback).length,
    latestId: recommendations[0]?.id || "",
    latestStatus: recommendations[0]?.status || ""
  };
}

function summarizeCloset(closetItems = []) {
  const items = closetItems || [];
  return {
    total: items.length,
    remoteReady: items.filter(hasPublicImageUrl).length,
    localOnly: items.filter((item) => !hasPublicImageUrl(item)).length,
    aliyunSuccess: items.filter((item) => item.analysisStatus === "success" || item.analyzer === "aliyun_imagerecog").length,
    fallbackCount: items.filter((item) => item.analysisStatus && item.analysisStatus !== "success").length,
    latestItem: items[0] ? {
      itemId: items[0].itemId || items[0].id || "",
      name: items[0].name || "",
      publicImageUrl: items[0].publicImageUrl || "",
      analysisStatus: items[0].analysisStatus || "",
      analyzer: items[0].analyzer || items[0].imageConfidence || "",
      category: items[0].category || "",
      colorLabel: items[0].colorLabel || "",
      styleLabels: items[0].styleLabels || [],
      sceneLabels: items[0].sceneLabels || [],
      bodyStrategyLabels: items[0].bodyStrategyLabels || [],
      analysisMessage: items[0].analysisMessage || "",
      analyzerError: items[0].analyzerError || "",
      fileServerError: items[0].fileServerError || ""
    } : null
  };
}

function blockerList({ generation, recommendations, closet } = {}) {
  const blockers = [];
  if (!generation.latestJobId) blockers.push("no_generation_job");
  if (generation.latestJobId && !generation.hasImage) blockers.push("latest_generation_has_no_image");
  if (generation.latestJobId && !generation.recommendationId) blockers.push("latest_generation_missing_recommendation");
  if (generation.recommendationId && !generation.recommendationLinked) blockers.push("latest_generation_recommendation_not_found");
  if (generation.latestJobId && !generation.recordVisible) blockers.push("latest_generation_not_visible_in_record");
  if (recommendations.total && !recommendations.imageBound) blockers.push("recommendations_not_bound_to_images");
  if (closet.total && closet.remoteReady < closet.total) blockers.push("closet_items_missing_public_image_url");
  if (closet.total && closet.aliyunSuccess === 0) blockers.push("closet_items_not_cloud_analyzed");
  return blockers;
}

function buildMvpReadinessReport(input = {}) {
  const generation = summarizeGeneration(input);
  const recommendations = summarizeRecommendations(input.recommendations || []);
  const closet = summarizeCloset(input.closetItems || []);
  const blockers = blockerList({ generation, recommendations, closet });
  return {
    ready: blockers.length === 0,
    blockers,
    generation,
    recommendations,
    closet
  };
}

module.exports = {
  buildMvpReadinessReport,
  summarizeCloset,
  summarizeGeneration,
  summarizeRecommendations
};
