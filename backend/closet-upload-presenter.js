function publicImageUrlFor(published = {}, item = {}) {
  return published.remoteUrl || item.publicImageUrl || item.remoteImageUrl || "";
}

function analysisStatusFor(created = {}) {
  const analysis = created.analysis || {};
  const item = created.item || {};
  return analysis.analysisStatus || item.analysisStatus || "";
}

function presentClosetUpload({ published = {}, created = {} } = {}) {
  const item = created.item || {};
  const publicImageUrl = publicImageUrlFor(published, item);
  const analysisStatus = analysisStatusFor(created);
  const remoteReady = Boolean(publicImageUrl);
  const analysisReady = analysisStatus === "success";
  const blockers = [];
  if (!remoteReady) blockers.push("public_image_url_missing");
  if (!analysisReady) blockers.push("cloud_analysis_not_ready");
  return {
    remoteReady,
    publicImageUrl,
    remoteProvider: published.remoteProvider || "",
    fileServerError: published.fileServerError || "",
    aliyunOssError: published.aliyunOssError || "",
    analysisReady,
    analysisStatus,
    analysisMessage: (created.analysis && created.analysis.analysisMessage) || item.analysisMessage || "",
    analyzer: (created.analysis && created.analysis.analyzer) || item.analyzer || item.imageConfidence || "",
    blockers
  };
}

module.exports = {
  presentClosetUpload
};
