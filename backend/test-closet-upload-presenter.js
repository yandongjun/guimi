const assert = require("assert");

const presenter = require("./closet-upload-presenter");

function main() {
  const result = presenter.presentClosetUpload({
    published: {
      remoteUrl: "https://cdn.example.com/item.jpg",
      remoteProvider: "file_server",
      fileServerError: "",
      aliyunOssError: ""
    },
    created: {
      item: {
        publicImageUrl: "https://cdn.example.com/item.jpg",
        analysisStatus: "success",
        analysisMessage: "",
        analyzer: "aliyun_imagerecog"
      },
      analysis: {
        analysisStatus: "success",
        analyzer: "aliyun_imagerecog"
      }
    }
  });

  assert.equal(result.remoteReady, true);
  assert.equal(result.publicImageUrl, "https://cdn.example.com/item.jpg");
  assert.equal(result.remoteProvider, "file_server");
  assert.equal(result.analysisReady, true);
  assert.equal(result.analysisStatus, "success");

  const fallback = presenter.presentClosetUpload({
    published: {
      remoteUrl: "",
      fileServerError: "not configured"
    },
    created: {
      item: {
        publicImageUrl: "",
        analysisStatus: "failed",
        analysisMessage: "云识别失败，已使用本地规则标签"
      }
    }
  });

  assert.equal(fallback.remoteReady, false);
  assert.equal(fallback.analysisReady, false);
  assert.equal(fallback.blockers[0], "public_image_url_missing");
  assert.equal(fallback.blockers[1], "cloud_analysis_not_ready");
}

main();
console.log("closet upload presenter checks passed");
