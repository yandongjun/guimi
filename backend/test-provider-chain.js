const assert = require("assert");

const providerChain = require("./provider-chain");

async function testFallbackToNextProvider() {
  const calls = [];
  const result = await providerChain.runProviderChain({
    operation: "demo",
    input: { value: 1 },
    providers: [
      {
        name: "first",
        run: async () => {
          calls.push("first");
          throw new Error("first failed");
        }
      },
      {
        name: "second",
        run: async ({ input }) => {
          calls.push("second");
          return { ok: true, value: input.value + 1 };
        }
      }
    ]
  });

  assert.deepStrictEqual(calls, ["first", "second"]);
  assert.strictEqual(result.provider, "second");
  assert.deepStrictEqual(result.result, { ok: true, value: 2 });
  assert.strictEqual(result.attempts.length, 2);
  assert.strictEqual(result.attempts[0].status, "failed");
  assert.strictEqual(result.attempts[1].status, "succeeded");
}

async function testSkipDisabledProvider() {
  const result = await providerChain.runProviderChain({
    operation: "demo",
    input: {},
    providers: [
      {
        name: "disabled",
        isEnabled: () => false,
        run: async () => {
          throw new Error("must not run");
        }
      },
      {
        name: "enabled",
        run: async () => ({ ok: true })
      }
    ]
  });

  assert.strictEqual(result.provider, "enabled");
  assert.strictEqual(result.attempts[0].status, "skipped");
  assert.strictEqual(result.attempts[1].status, "succeeded");
}

async function testAllProvidersFail() {
  await assert.rejects(
    () => providerChain.runProviderChain({
      operation: "demo",
      input: {},
      providers: [
        { name: "first", run: async () => { throw new Error("first failed"); } },
        { name: "second", run: async () => { throw new Error("second failed"); } }
      ]
    }),
    (error) => {
      assert.match(error.message, /all providers failed/i);
      assert.strictEqual(error.operation, "demo");
      assert.strictEqual(error.attempts.length, 2);
      assert.strictEqual(error.attempts[1].error, "second failed");
      return true;
    }
  );
}

async function main() {
  await testFallbackToNextProvider();
  await testSkipDisabledProvider();
  await testAllProvidersFail();
  console.log("provider chain tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
