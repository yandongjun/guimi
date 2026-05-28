const endpoint = "https://www.moxing.pro/v1/media/generations";

function getApiKey() {
  return process.env.MOXING_API_KEY || "";
}

function extractImageUrl(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (typeof payload === "string") return payload;
  if (payload.url) return payload.url;
  if (payload.image_url) return payload.image_url;
  if (payload.imageUrl) return payload.imageUrl;
  if (payload.output_url) return payload.output_url;
  if (payload.primary_url) return payload.primary_url;
  if (payload.primaryUrl) return payload.primaryUrl;
  if (Array.isArray(payload.urls) && payload.urls[0]) return payload.urls[0];
  if (Array.isArray(payload.data) && payload.data[0]) {
    if (typeof payload.data[0] === "string") return payload.data[0];
    return extractImageUrl(payload.data[0]) || payload.data[0].b64_json || "";
  }
  if (Array.isArray(payload.images) && payload.images[0]) {
    if (typeof payload.images[0] === "string") return payload.images[0];
    return extractImageUrl(payload.images[0]);
  }
  if (payload.output && Array.isArray(payload.output) && payload.output[0]) {
    if (typeof payload.output[0] === "string") return payload.output[0];
    return extractImageUrl(payload.output[0]);
  }
  if (payload.data && typeof payload.data === "object") return extractImageUrl(payload.data);
  if (payload.result && typeof payload.result === "object") {
    return extractImageUrl(payload.result);
  }
  return "";
}

function normalizeTaskStatus(status) {
  if (status === "succeeded") return "ready";
  if (status === "failed") return "failed";
  if (status === "running" || status === "queued") return status;
  return status || "submitted";
}

async function generateImage(job) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("MOXING_API_KEY is not set");
  }

  const size = job.providerRequest && job.providerRequest.size
    ? job.providerRequest.size
    : `${job.size.width}x${job.size.height}`;

  const body = {
    capability: "image_generation",
    model: job.model || "gpt-image-2",
    n: 1,
    prompt: job.prompt,
    quality: "medium",
    response_format: "url",
    size
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch (error) {
    payload = { raw: text };
  }

  if (!response.ok) {
    const message = payload.message || payload.error?.message || `moxing request failed: ${response.status}`;
    throw new Error(message);
  }

  const imageUrl = extractImageUrl(payload);
  if (!imageUrl) {
    const error = new Error("moxing response did not include an image url");
    error.providerRequest = body;
    error.providerResponse = payload;
    throw error;
  }

  return {
    imageUrl,
    providerRequest: body,
    providerResponse: payload
  };
}

async function requestJson(path, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("MOXING_API_KEY is not set");
  }

  const response = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch (error) {
    payload = { raw: text };
  }
  if (!response.ok) {
    const message = payload.message || payload.error?.message || `moxing request failed: ${response.status}`;
    const error = new Error(message);
    error.providerResponse = payload;
    throw error;
  }
  return payload;
}

async function submitImage(job) {
  const size = job.providerRequest && job.providerRequest.size
    ? job.providerRequest.size
    : `${job.size.width}x${job.size.height}`;

  const body = {
    capability: "image_generation",
    model: job.model || "gpt-image-2",
    n: 1,
    prompt: job.prompt,
    quality: "medium",
    response_format: "url",
    size
  };

  const payload = await requestJson(endpoint, {
    method: "POST",
    body: JSON.stringify(body)
  });

  const imageUrl = extractImageUrl(payload);
  const taskId = payload.task_id || payload.id || payload.taskId || payload.data?.task_id || "";
  if (payload.status === "succeeded" && !imageUrl) {
    const error = new Error("moxing task succeeded but did not include an image url");
    error.providerRequest = body;
    error.providerResponse = payload;
    throw error;
  }

  return {
    status: imageUrl ? "ready" : normalizeTaskStatus(payload.status),
    imageUrl,
    taskId,
    providerRequest: body,
    providerResponse: payload
  };
}

async function pollImage(taskId) {
  if (!taskId) {
    throw new Error("moxing task id is empty");
  }

  const candidates = [
    `https://www.moxing.pro/v1/media/tasks/${encodeURIComponent(taskId)}`,
  ];

  let lastError;
  for (const url of candidates) {
    try {
      const payload = await requestJson(url, { method: "GET" });
      const imageUrl = extractImageUrl(payload);
      if (payload.status === "failed") {
        const error = new Error(payload.error_message || "moxing image task failed");
        error.providerResponse = payload;
        throw error;
      }
      if (payload.status === "succeeded" && !imageUrl) {
        const error = new Error("moxing task succeeded but did not include an image url");
        error.providerResponse = payload;
        throw error;
      }
      return {
        status: imageUrl ? "ready" : normalizeTaskStatus(payload.status || payload.data?.status),
        imageUrl,
        providerResponse: payload,
        pollUrl: url
      };
    } catch (error) {
      lastError = error;
      const message = String(error.message);
      const shouldTryNext = message.includes("404") || message.includes("Invalid URL");
      if (!shouldTryNext) break;
    }
  }
  throw lastError || new Error("moxing poll failed");
}

async function pollImageWithUrl(taskId, urlTemplate) {
  if (!taskId) {
    throw new Error("moxing task id is empty");
  }
  if (!urlTemplate) {
    throw new Error("moxing poll url template is empty");
  }
  const url = urlTemplate.includes("{task_id}")
    ? urlTemplate.replace("{task_id}", encodeURIComponent(taskId))
    : `${urlTemplate}${encodeURIComponent(taskId)}`;
  const payload = await requestJson(url, { method: "GET" });
  const imageUrl = extractImageUrl(payload);
  if (payload.status === "failed") {
    const error = new Error(payload.error_message || "moxing image task failed");
    error.providerResponse = payload;
    throw error;
  }
  if (payload.status === "succeeded" && !imageUrl) {
    const error = new Error("moxing task succeeded but did not include an image url");
    error.providerResponse = payload;
    throw error;
  }
  return {
    status: imageUrl ? "ready" : normalizeTaskStatus(payload.status || payload.data?.status),
    imageUrl,
    providerResponse: payload,
    pollUrl: url
  };
}

async function pollImageByPost(taskId, url, body = {}) {
  if (!taskId) {
    throw new Error("moxing task id is empty");
  }
  if (!url) {
    throw new Error("moxing poll url is empty");
  }
  const payload = await requestJson(url, {
    method: "POST",
    body: JSON.stringify({ task_id: taskId, ...body })
  });
  const imageUrl = extractImageUrl(payload);
  if (payload.status === "failed") {
    const error = new Error(payload.error_message || "moxing image task failed");
    error.providerResponse = payload;
    throw error;
  }
  if (payload.status === "succeeded" && !imageUrl) {
    const error = new Error("moxing task succeeded but did not include an image url");
    error.providerResponse = payload;
    throw error;
  }
  return {
    status: imageUrl ? "ready" : normalizeTaskStatus(payload.status || payload.data?.status),
    imageUrl,
    providerResponse: payload,
    pollUrl: url
  };
}

module.exports = {
  extractImageUrl,
  generateImage,
  submitImage,
  pollImage,
  pollImageWithUrl,
  pollImageByPost
};
