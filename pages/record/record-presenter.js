const STATUS_TEXT = {
  ready: "已生成",
  failed: "生成失败",
  incomplete: "生成失败",
  pending: "排队中",
  submitted: "生成中",
  queued: "排队中",
  running: "生成中",
  processing: "生成中"
};

const STATUS_CLASS = {
  ready: "ready",
  failed: "failed",
  incomplete: "failed",
  pending: "working",
  submitted: "working",
  queued: "working",
  running: "working",
  processing: "working"
};

function formatTime(value = "") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}月${day}日 ${hour}:${minute}`;
}

function normalizeImageKey(imageUrl = "") {
  return String(imageUrl || "").split("?")[0];
}

function titleFor(job = {}) {
  return job.displayRecordTitle
    || (job.outfitBrief && job.outfitBrief.title)
    || job.outfitTitle
    || job.displayTitle
    || "穿搭生成记录";
}

function normalizeJobs(jobs = []) {
  const seenImageKeys = new Map();
  return (Array.isArray(jobs) ? jobs : []).map((job = {}, index) => {
    const imageKey = normalizeImageKey(job.imageUrl);
    const sameImageCount = imageKey ? (seenImageKeys.get(imageKey) || 0) + 1 : 0;
    if (imageKey) seenImageKeys.set(imageKey, sameImageCount);
    return {
      ...job,
      recordIndex: index + 1,
      statusText: STATUS_TEXT[job.status] || job.status || "未知",
      statusClass: STATUS_CLASS[job.status] || "muted",
      displayScene: job.scene || "未记录场景",
      displayTitle: titleFor(job),
      displayTime: formatTime(job.updatedAt || job.createdAt),
      closetText: (job.usedClosetItemLabels || []).join(" / "),
      modeText: job.sourceMode === "free" ? "自由搭配" : "优先衣橱",
      styleText: job.stylePreference || "",
      hasImage: Boolean(job.imageUrl),
      imageKey,
      repeatedImage: sameImageCount > 1,
      previewCta: job.imageUrl ? "查看大图" : STATUS_TEXT[job.status] || "暂无图片"
    };
  });
}

module.exports = {
  formatTime,
  normalizeJobs
};
