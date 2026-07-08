const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const runtimeDir = path.join(os.tmpdir(), `guimi-user-state-${Date.now()}`);
process.env.GUIMI_RUNTIME_DIR = runtimeDir;

const userStateStore = require("./user-state-store");

async function main() {
  const seed = {
    activeUserId: "user-a",
    generationUsed: 0,
    adUnlocks: 0,
    users: [{ id: "user-a", nickname: "A" }],
    closetItems: [{ id: "closet-a", name: "blue tee" }]
  };

  const loaded = userStateStore.loadState(seed);
  assert.equal(loaded.closetItems.length, 1);

  const saved = userStateStore.saveState({
    ...loaded,
    closetItems: [{ id: "closet-b", name: "black shoes" }]
  });
  assert.equal(saved.closetItems.length, 1);
  assert.equal(saved.closetItems[0].id, "closet-b");

  const reloaded = userStateStore.loadState(seed);
  assert.equal(reloaded.closetItems.length, 1);
  assert.equal(reloaded.closetItems[0].id, "closet-b");
}

main()
  .then(() => {
    fs.rmSync(runtimeDir, { recursive: true, force: true });
    console.log("user state store checks passed");
  })
  .catch((error) => {
    fs.rmSync(runtimeDir, { recursive: true, force: true });
    console.error(error);
    process.exit(1);
  });
