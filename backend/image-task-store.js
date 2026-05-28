const fs = require("fs");
const path = require("path");

const storePath = path.join(__dirname, "storage", "image-jobs.json");

function ensureStore() {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, "[]\n", "utf8");
  }
}

function readJobs() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(storePath, "utf8"));
  } catch (error) {
    return [];
  }
}

function writeJobs(jobs) {
  ensureStore();
  fs.writeFileSync(storePath, `${JSON.stringify(jobs, null, 2)}\n`, "utf8");
}

function createJob(payload) {
  const jobs = readJobs();
  const id = payload.id || `img-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const now = new Date().toISOString();
  const job = {
    id,
    status: "pending",
    provider: payload.provider || "moxing",
    model: payload.model || "gpt-image-2",
    userId: payload.userId,
    userName: payload.userName,
    scene: payload.scene,
    outfitTitle: payload.outfitTitle,
    targetPath: payload.targetPath,
    prompt: payload.prompt,
    negativePrompt: payload.negativePrompt || "",
    promptContract: payload.promptContract || null,
    promptContractStatus: payload.promptContractStatus || "unchecked",
    promptContractMissing: payload.promptContractMissing || [],
    size: payload.size || { width: 1024, height: 1536 },
    source: payload.source || "manual",
    providerRequest: payload.providerRequest || null,
    providerResponse: payload.providerResponse || null,
    providerTaskId: payload.providerTaskId || "",
    providerPollUrl: payload.providerPollUrl || "",
    remoteImageUrl: payload.remoteImageUrl || "",
    imageUrl: "",
    localImageBytes: 0,
    errorMessage: "",
    createdAt: now,
    updatedAt: now
  };
  const existingIndex = jobs.findIndex((item) => item.id === id);
  if (existingIndex !== -1) {
    jobs[existingIndex] = {
      ...jobs[existingIndex],
      ...job,
      createdAt: jobs[existingIndex].createdAt,
      updatedAt: now
    };
    writeJobs(jobs);
    return jobs[existingIndex];
  }
  jobs.unshift(job);
  writeJobs(jobs);
  return job;
}

function listJobs(filter = {}) {
  const jobs = readJobs();
  if (!filter.status) return jobs;
  return jobs.filter((job) => job.status === filter.status);
}

function updateJob(id, patch) {
  const jobs = readJobs();
  const index = jobs.findIndex((job) => job.id === id);
  if (index === -1) return null;
  jobs[index] = {
    ...jobs[index],
    ...patch,
    updatedAt: new Date().toISOString()
  };
  writeJobs(jobs);
  return jobs[index];
}

module.exports = {
  createJob,
  listJobs,
  updateJob
};
