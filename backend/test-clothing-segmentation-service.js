const assert = require("assert");

const clothingSegmentation = require("./clothing-segmentation-service");

async function main() {
  const result = await clothingSegmentation.segmentClothingFromPersonImage({
    imageUrl: "https://cdn.example.com/person.jpg",
    client: {
      segmentCloth: async (request) => ({
        body: {
          requestId: "req-1",
          data: {
            elements: [
              { imageURL: "https://cdn.example.com/top.png", classUrl: { tops: "https://cdn.example.com/top-mask.png" } },
              { imageURL: "https://cdn.example.com/pants.png", classUrl: { pants: "https://cdn.example.com/pants-mask.png" } }
            ]
          }
        },
        request
      })
    }
  });

  assert.equal(result.status, "success");
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].aliyunClass, "tops");
  assert.equal(result.items[0].category, "top");
  assert.equal(result.items[1].category, "bottom");
  assert.equal(result.requestId, "req-1");
}

main()
  .then(() => console.log("clothing segmentation checks passed"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
