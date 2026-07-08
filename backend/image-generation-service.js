const providerChain = require("./provider-chain");
const moxingImage = require("./providers/moxing-image");

function defaultProviders() {
  return [
    {
      name: "moxing",
      isEnabled: () => Boolean(process.env.MOXING_API_KEY),
      run: async ({ input }) => moxingImage.submitImage(input.job)
    }
  ];
}

async function submitImage(job, options = {}) {
  const chainResult = await providerChain.runProviderChain({
    operation: "submit_image",
    input: { job },
    providers: (options.providers || defaultProviders()).map((provider) => ({
      ...provider,
      run: provider.run || (provider.submit
        ? ({ input, context, operation }) => provider.submit({ job: input.job, context, operation })
        : undefined)
    }))
  });
  const result = chainResult.result || {};
  return {
    ...result,
    provider: chainResult.provider,
    providerAttempts: chainResult.attempts
  };
}

module.exports = {
  defaultProviders,
  submitImage
};
