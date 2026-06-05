const fs = require("fs");
const path = require("path");
const backgroundRemoval = require("./providers/background-removal");

/* ------------------------------ 参数与路径处理 ------------------------------ */

/**
 * 功能：解析命令行参数并构造输入输出路径。
 * 参数：无。
 * 返回：包含 sourcePath 和 targetPath 的对象。
 * 异常：参数缺失或文件不存在时抛出异常。
 */
function resolvePaths() {
  const sourceArg = process.argv[2];
  if (!sourceArg) {
    throw new Error("请传入原图路径，例如：node backend/debug-single-cutout.js E:\\path\\to\\image.png");
  }
  const sourcePath = path.resolve(sourceArg);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`原图不存在: ${sourcePath}`);
  }
  const ext = path.extname(sourcePath) || ".png";
  const targetPath = path.join(path.dirname(sourcePath), `${path.basename(sourcePath, ext)}-cutout.png`);
  return { sourcePath, targetPath };
}

/* ------------------------------ 单图抠图测试 ------------------------------ */

/**
 * 功能：调用当前启用的抠图 provider，对单张图片执行抠图并打印结果。
 * 参数：无。
 * 返回：无。
 * 异常：抛出抠图失败原因，便于直接在终端定位问题。
 */
async function main() {
  const { sourcePath, targetPath } = resolvePaths();
  console.log("[DEBUG-single-cutout] provider", backgroundRemoval.getDebugConfig());
  console.log("[DEBUG-single-cutout] start", { sourcePath, targetPath });
  await backgroundRemoval.removeBackground(sourcePath, targetPath, {
    mimeType: sourcePath.toLowerCase().endsWith(".jpg") || sourcePath.toLowerCase().endsWith(".jpeg")
      ? "image/jpeg"
      : sourcePath.toLowerCase().endsWith(".webp")
        ? "image/webp"
        : "image/png",
    fileName: path.basename(sourcePath),
    crop: true,
    size: "full"
  });
  console.log("[DEBUG-single-cutout] ok", { targetPath });
}

main().catch((error) => {
  console.error("[DEBUG-single-cutout] fail", error && error.message ? error.message : error);
  process.exit(1);
});
