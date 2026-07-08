const assert = require("assert");

const clothingAnalysis = require("./clothing-analysis-service");

async function main() {
  const result = await clothingAnalysis.analyzeClothingImage({
    originalName: "cream short blazer.jpg",
    imageUrl: "https://cdn.example.com/cream-blazer.jpg",
    mimeType: "image/jpeg"
  });

  assert.equal(result.category, "outerwear");
  assert.equal(result.categoryLabel, "外套");
  assert.equal(result.color, "cream_white");
  assert.equal(result.colorLabel, "奶油白");
  assert.ok(result.name.includes("西装"));
  assert.ok(!result.styleTags.includes("clean_fit"));
  assert.ok(result.styleTags.includes("commute"));
  assert.ok(result.bodyStrategyTags.includes("define_shoulder"));
  assert.ok(result.sceneTags.includes("office"));

  const aliyunResult = await clothingAnalysis.analyzeClothingImage({
    imageUrl: "https://cdn.example.com/dress.png",
    categoryHint: "dress",
    client: {
      taggingImage: async () => ({
        body: {
          requestId: "tag-1",
          data: { tags: [{ value: "连衣裙", confidence: 0.91 }] }
        }
      }),
      recognizeImageColor: async () => ({
        body: {
          requestId: "color-1",
          data: { colorTemplateList: [{ label: "绿色", color: "#9fad95", percentage: 0.65 }] }
        }
      })
    }
  });

  assert.equal(aliyunResult.category, "dress");
  assert.equal(aliyunResult.analyzer, "aliyun_imagerecog");
  assert.equal(aliyunResult.rawTags[0].value, "连衣裙");
  assert.ok(aliyunResult.rawColors.length > 0);

  const tshirtResult = await clothingAnalysis.analyzeClothingImage({
    imageUrl: "https://cdn.example.com/blue-tshirt.png",
    originalName: "blue short sleeve tshirt.png",
    client: {
      taggingImage: async () => ({
        body: {
          requestId: "tag-2",
          data: {
            tags: [
              { value: "T恤", confidence: 15 },
              { value: "衣物", confidence: 12 }
            ]
          }
        }
      }),
      recognizeImageColor: async () => ({
        body: {
          requestId: "color-2",
          data: {
            colorTemplateList: [
              { label: "white", color: "FDFEFD", percentage: 0.36 },
              { label: "blue", color: "0E4D8B", percentage: 0.27 },
              { label: "blue", color: "044186", percentage: 0.18 },
              { label: "blue", color: "2A5F94", percentage: 0.11 }
            ]
          }
        }
      })
    }
  });

  assert.equal(tshirtResult.category, "top");
  assert.equal(tshirtResult.subCategory, "short_sleeve_tshirt");
  assert.notEqual(tshirtResult.color, "cream_white");
  assert.ok(tshirtResult.styleTags.includes("casual"));
  assert.ok(tshirtResult.styleTags.includes("summer_light"));

  const burgundySkirt = await clothingAnalysis.analyzeClothingImage({
    imageUrl: "https://cdn.example.com/burgundy-skirt.png",
    originalName: "burgundy midi skirt.png",
    client: {
      taggingImage: async () => ({
        body: {
          requestId: "tag-3",
          data: {
            tags: [
              { value: "半身裙", confidence: 70 },
              { value: "裙子", confidence: 60 }
            ]
          }
        }
      }),
      recognizeImageColor: async () => ({
        body: {
          requestId: "color-3",
          data: {
            colorTemplateList: [
              { label: "purple", color: "7A2F56", percentage: 0.58 },
              { label: "red", color: "8A3342", percentage: 0.24 }
            ]
          }
        }
      })
    }
  });

  assert.equal(burgundySkirt.category, "bottom");
  assert.equal(burgundySkirt.subCategory, "skirt");
  assert.equal(burgundySkirt.color, "burgundy");
  assert.equal(burgundySkirt.colorLabel, "酒红色");

  const flatSandal = await clothingAnalysis.analyzeClothingImage({
    imageUrl: "https://cdn.example.com/flat-sandal.png",
    originalName: "flat sandal.png",
    client: {
      taggingImage: async () => ({
        body: {
          requestId: "tag-4",
          data: {
            tags: [
              { value: "凉鞋", confidence: 99 },
              { value: "平底鞋", confidence: 80 }
            ]
          }
        }
      }),
      recognizeImageColor: async () => ({
        body: {
          requestId: "color-4",
          data: {
            colorTemplateList: [
              { label: "gray", color: "B8B2A8", percentage: 0.55 },
              { label: "yellow", color: "D8C69A", percentage: 0.25 }
            ]
          }
        }
      })
    }
  });

  assert.equal(flatSandal.category, "shoes");
  assert.ok(flatSandal.styleTags.includes("light_shoes"));
  assert.ok(!flatSandal.styleLabels.includes("干净利落"));
  assert.ok(!flatSandal.bodyStrategyLabels.includes("拉长腿部比例"));
  assert.ok(flatSandal.bodyStrategyLabels.includes("行走舒适"));
}

main()
  .then(() => console.log("clothing analysis checks passed"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
