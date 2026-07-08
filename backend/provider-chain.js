function providerName(provider, index) {
  return provider && provider.name ? provider.name : `provider_${index + 1}`;
}

function errorMessage(error) {
  if (!error) return "unknown error";
  return error.message || String(error);
}

async function isProviderEnabled(provider, context) {
  if (!provider || typeof provider.isEnabled !== "function") return true;
  return Boolean(await provider.isEnabled(context));
}

async function runProviderChain({ providers = [], operation = "operation", input = {}, context = {} } = {}) {
  if (!Array.isArray(providers) || !providers.length) {
    const error = new Error(`${operation}: no providers configured`);
    error.operation = operation;
    error.attempts = [];
    throw error;
  }

  const attempts = [];
  for (let index = 0; index < providers.length; index += 1) {
    const provider = providers[index];
    const name = providerName(provider, index);
    if (!provider || typeof provider.run !== "function") {
      attempts.push({ provider: name, status: "skipped", reason: "missing run function" });
      continue;
    }

    const enabled = await isProviderEnabled(provider, { input, context, operation });
    if (!enabled) {
      attempts.push({ provider: name, status: "skipped", reason: "disabled" });
      continue;
    }

    try {
      const result = await provider.run({ input, context, operation });
      attempts.push({ provider: name, status: "succeeded" });
      return {
        provider: name,
        result,
        attempts
      };
    } catch (error) {
      attempts.push({
        provider: name,
        status: "failed",
        error: errorMessage(error),
        providerRequest: error.providerRequest || null,
        providerResponse: error.providerResponse || null
      });
    }
  }

  const error = new Error(`${operation}: all providers failed`);
  error.operation = operation;
  error.attempts = attempts;
  const lastFailure = [...attempts].reverse().find((attempt) => attempt.status === "failed");
  if (lastFailure) {
    error.providerRequest = lastFailure.providerRequest || null;
    error.providerResponse = lastFailure.providerResponse || null;
  }
  throw error;
}

module.exports = {
  runProviderChain
};
