const assert = require("assert");

const imageGenerationService = require("./image-generation-service");

async function testImageProviderFallback() {
  const result = await imageGenerationService.submitImage(
    { id: "job-1", prompt: "test" },
    {
      providers: [
        {
          name: "primary_image",
          submit: async () => {
            throw new Error("primary unavailable");
          }
        },
        {
          name: "backup_image",
          submit: async ({ job }) => ({
            status: "ready",
            imageUrl: "https://example.com/image.png",
            providerResponse: { ok: true, jobId: job.id }
          })
        }
      ]
    }
  );

  assert.strictEqual(result.provider, "backup_image");
  assert.strictEqual(result.imageUrl, "https://example.com/image.png");
  assert.strictEqual(result.providerAttempts.length, 2);
  assert.strictEqual(result.providerAttempts[0].status, "failed");
  assert.strictEqual(result.providerResponse.ok, true);
}

async function testDisabledImageProviderIsSkipped() {
  const result = await imageGenerationService.submitImage(
    { id: "job-2", prompt: "test" },
    {
      providers: [
        {
          name: "disabled_image",
          isEnabled: () => false,
          submit: async () => {
            throw new Error("must not run");
          }
        },
        {
          name: "enabled_image",
          submit: async () => ({ status: "submitted", taskId: "task-1" })
        }
      ]
    }
  );

  assert.strictEqual(result.provider, "enabled_image");
  assert.strictEqual(result.taskId, "task-1");
  assert.strictEqual(result.providerAttempts[0].status, "skipped");
}

async function main() {
  await testImageProviderFallback();
  await testDisabledImageProviderIsSkipped();
  console.log("image generation service tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
