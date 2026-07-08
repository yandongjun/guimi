const assert = require("assert");

const mvpDebug = require("./mvp-debug-service");

function main() {
  const report = mvpDebug.buildMvpReadinessReport({
    imageJobs: [
      {
        id: "img-1",
        status: "ready",
        recommendationId: "rec-1",
        imageUrl: "/assets/local/a.jpg?v=1",
        remoteImageUrl: "https://cdn.example.com/a.jpg",
        provider: "moxing",
        providerAttempts: [{ provider: "moxing", status: "succeeded" }],
        usedClosetItemIds: ["c1"],
        usedClosetItemLabels: ["奶油白外套"],
        updatedAt: "2026-06-18T08:00:00.000Z"
      }
    ],
    publicImageJobs: [
      {
        id: "img-1",
        status: "ready",
        recommendationId: "rec-1",
        imageUrl: "http://127.0.0.1:8787/assets/local/a.jpg?v=1",
        usedClosetItemIds: ["c1"],
        usedClosetItemLabels: ["奶油白外套"]
      }
    ],
    recommendations: [
      {
        id: "rec-1",
        imageJobId: "img-1",
        generatedImageUrl: "http://127.0.0.1:8787/assets/local/a.jpg?v=1",
        selectedItemIds: ["c1"],
        feedback: { rating: "like" }
      }
    ],
    closetItems: [
      {
        itemId: "c1",
        name: "奶油白外套",
        publicImageUrl: "https://cdn.example.com/coat.jpg",
        analysisStatus: "success",
        analyzer: "aliyun_imagerecog",
        category: "outerwear",
        colorLabel: "奶油白",
        styleLabels: ["通勤"],
        sceneLabels: ["上班"],
        bodyStrategyLabels: ["提高腰线"]
      }
    ]
  });

  assert.equal(report.generation.latestJobId, "img-1");
  assert.equal(report.generation.hasImage, true);
  assert.equal(report.generation.recommendationLinked, true);
  assert.equal(report.generation.recordVisible, true);
  assert.equal(report.recommendations.feedbackCount, 1);
  assert.equal(report.closet.remoteReady, 1);
  assert.equal(report.closet.aliyunSuccess, 1);
  assert.deepEqual(report.blockers, []);

  const blocked = mvpDebug.buildMvpReadinessReport({
    imageJobs: [{ id: "img-2", status: "failed", errorMessage: "provider failed" }],
    publicImageJobs: [{ id: "img-2", status: "failed", errorMessage: "provider failed" }],
    recommendations: [],
    closetItems: [{ itemId: "c2", name: "本地鞋", analysisStatus: "failed", publicImageUrl: "" }]
  });

  assert.ok(blocked.blockers.includes("latest_generation_has_no_image"));
  assert.ok(blocked.blockers.includes("latest_generation_missing_recommendation"));
  assert.ok(blocked.blockers.includes("closet_items_missing_public_image_url"));
}

main();
console.log("mvp debug service checks passed");
