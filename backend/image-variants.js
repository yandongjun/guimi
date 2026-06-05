const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { PNG } = require("pngjs");

/* ------------------------------ 图片处理常量 ------------------------------ */

const BODY_SCAN_TARGETS = {
  portrait: { width: 1024, height: 1536 },
  square: { width: 1024, height: 1024 }
};

const DEFAULT_BACKGROUND = "white";
const TRANSPARENT_BACKGROUND = "black@0.0";

/* ------------------------------ 基础工具方法 ------------------------------ */

/**
 * 功能：确保目标文件所在目录存在。
 * 参数：filePath 目标文件绝对路径。
 * 返回：无。
 * 异常：目录创建失败时抛出系统异常。
 */
function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

/**
 * 功能：统一执行 ffmpeg，并在失败时给出可读错误。
 * 参数：args ffmpeg 参数数组。
 * 返回：无。
 * 异常：ffmpeg 不存在或执行失败时抛出异常。
 */
function runFfmpegSync(args) {
  return spawnSync("ffmpeg", args, {
    encoding: "utf8",
    windowsHide: true
  });
}

/**
 * 功能：统一执行 ffmpeg，并在失败时给出可读错误。
 * 参数：args ffmpeg 参数数组。
 * 返回：ffmpeg 的执行结果。
 * 异常：ffmpeg 不存在或执行失败时抛出异常。
 */
function runFfmpeg(args) {
  const result = runFfmpegSync(args);
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "unknown ffmpeg error").trim();
    throw new Error(`ffmpeg failed: ${detail}`);
  }
}

/**
 * 功能：根据输出文件类型生成 ffmpeg 的单帧输出参数。
 * 参数：targetPath 输出文件绝对路径。
 * 返回：ffmpeg 参数数组。
 * 异常：无。
 */
function singleFrameOutputArgs(targetPath) {
  const ext = path.extname(targetPath).toLowerCase();
  if (ext === ".png") {
    return ["-frames:v", "1", "-c:v", "png"];
  }
  return ["-frames:v", "1", "-q:v", "2"];
}

/**
 * 功能：把数值压成不小于 2 的偶数，避免 ffmpeg 在常见像素格式下报错。
 * 参数：value 任意尺寸值。
 * 返回：偶数尺寸。
 * 异常：无。
 */
function evenFloor(value) {
  return Math.max(2, Math.floor(Number(value || 0) / 2) * 2);
}

/**
 * 功能：构造“保全人物比例”的缩放补边滤镜。
 * 参数：width 目标宽度，height 目标高度，background 补边背景色。
 * 返回：ffmpeg 的 vf 字符串。
 * 异常：无。
 */
function containFilter(width, height, background = DEFAULT_BACKGROUND) {
  return [
    `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:${background}`
  ].join(",");
}

/**
 * 功能：构造“保全人物比例但不再补边”的缩放滤镜，便于后续按脚底对齐做紧凑排版。
 * 参数：width 目标宽度，height 目标高度。
 * 返回：ffmpeg 的 vf 字符串。
 * 异常：无。
 */
function fitFilter(width, height) {
  return `scale=${width}:${height}:force_original_aspect_ratio=decrease`;
}

/**
 * 功能：扫描透明 PNG 的 alpha 通道，找出真实人物主体的包围盒。
 * 参数：sourcePath 透明 PNG 绝对路径，options 可选参数。
 * 返回：包含 x/y/width/height 的裁剪框；若未找到主体则返回 null。
 * 异常：PNG 读取失败时抛出异常。
 */
function detectOpaqueBounds(sourcePath, options = {}) {
  const png = PNG.sync.read(fs.readFileSync(sourcePath));
  const alphaThreshold = Math.max(0, Math.min(255, Number(options.alphaThreshold || 8)));
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const offset = (png.width * y + x) * 4;
      const alpha = png.data[offset + 3];
      if (alpha <= alphaThreshold) {
        continue;
      }
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  const contentWidth = maxX - minX + 1;
  const contentHeight = maxY - minY + 1;
  const marginRatio = Number(options.marginRatio || 0.035);
  const marginX = Math.max(4, Math.round(contentWidth * marginRatio));
  const marginY = Math.max(4, Math.round(contentHeight * marginRatio));
  const x = Math.max(0, minX - marginX);
  const y = Math.max(0, minY - marginY);
  const width = Math.min(png.width - x, contentWidth + marginX * 2);
  const height = Math.min(png.height - y, contentHeight + marginY * 2);

  return {
    x,
    y,
    width,
    height
  };
}

/**
 * 功能：把透明 PNG 紧裁到人物主体附近，显著提升后续合图的人物占比。
 * 参数：sourcePath 原始透明 PNG，targetPath 紧裁后的输出 PNG。
 * 返回：输出文件绝对路径。
 * 异常：ffmpeg 失败时抛出异常。
 */
function trimTransparentImage(sourcePath, targetPath) {
  const bounds = detectOpaqueBounds(sourcePath);
  ensureParentDir(targetPath);
  if (!bounds) {
    fs.copyFileSync(sourcePath, targetPath);
    return targetPath;
  }
  runFfmpeg([
    "-y",
    "-i",
    sourcePath,
    "-vf",
    `crop=${bounds.width}:${bounds.height}:${bounds.x}:${bounds.y}`,
    ...singleFrameOutputArgs(targetPath),
    targetPath
  ]);
  return targetPath;
}

/* ------------------------------ 单图定比例输出 ------------------------------ */

/**
 * 功能：把一张上传图输出为固定比例版本，保持人物比例并自动补边。
 * 参数：sourcePath 原图绝对路径，targetPath 输出绝对路径，size 目标尺寸。
 * 返回：输出文件绝对路径。
 * 异常：ffmpeg 失败时抛出异常。
 */
function createContainedImage(sourcePath, targetPath, size) {
  ensureParentDir(targetPath);
  runFfmpeg([
    "-y",
    "-i",
    sourcePath,
    "-vf",
    containFilter(size.width, size.height),
    ...singleFrameOutputArgs(targetPath),
    targetPath
  ]);
  return targetPath;
}

/**
 * 功能：为单张三视图上传图生成两套固定比例版本。
 * 参数：sourcePath 原图绝对路径，baseOutputPath 输出基名绝对路径，不带扩展名。
 * 返回：包含 portrait 和 square 的绝对路径结果。
 * 异常：ffmpeg 失败时抛出异常。
 */
function createBodyScanVariants(sourcePath, baseOutputPath) {
  return {
    portrait: createContainedImage(
      sourcePath,
      `${baseOutputPath}-1024x1536.jpg`,
      BODY_SCAN_TARGETS.portrait
    ),
    square: createContainedImage(
      sourcePath,
      `${baseOutputPath}-1024x1024.jpg`,
      BODY_SCAN_TARGETS.square
    )
  };
}

/* ------------------------------ 三视图合图输出 ------------------------------ */

/**
 * 功能：根据背景配置生成合图的底板滤镜。
 * 参数：size 目标尺寸，background 背景色。
 * 返回：ffmpeg 颜色源滤镜字符串。
 * 异常：无。
 */
function backgroundSource(size, background) {
  return background === TRANSPARENT_BACKGROUND
    ? `color=c=${background}:s=${size.width}x${size.height},format=rgba[bg]`
    : `color=c=${background}:s=${size.width}x${size.height}[bg]`;
}

/**
 * 功能：把正侧背三张图做紧凑横排预览，按脚底对齐，优先提升人物主体占比。
 * 参数：sourcePaths 按 front/side/back 顺序的三张图，targetPath 输出路径，size 目标尺寸。
 * 返回：输出文件绝对路径。
 * 异常：输入不足三张或 ffmpeg 失败时抛出异常。
 */
function createPreviewComposite(sourcePaths, targetPath, size, options = {}) {
  if (!Array.isArray(sourcePaths) || sourcePaths.length !== 3) {
    throw new Error("three source images are required");
  }

  const outerPaddingX = evenFloor(options.outerPaddingX || 24);
  const topPadding = evenFloor(options.topPadding || 40);
  const bottomPadding = evenFloor(options.bottomPadding || 48);
  const gap = evenFloor(options.gap || 12);
  const contentHeight = evenFloor(size.height - topPadding - bottomPadding);
  const cellWidth = evenFloor((size.width - outerPaddingX * 2 - gap * 2) / 3);

  const totalContentWidth = cellWidth * 3 + gap * 2;
  const left1 = evenFloor((size.width - totalContentWidth) / 2);
  const left2 = left1 + cellWidth + gap;
  const left3 = left2 + cellWidth + gap;
  const background = options.background || DEFAULT_BACKGROUND;

  const filter = [
    backgroundSource(size, background),
    `[0:v]${fitFilter(cellWidth, contentHeight)},format=rgba[front]`,
    `[1:v]${fitFilter(cellWidth, contentHeight)},format=rgba[side]`,
    `[2:v]${fitFilter(cellWidth, contentHeight)},format=rgba[back]`,
    `[bg][front]overlay=${left1}:${topPadding + contentHeight}-h:format=auto[bg1]`,
    `[bg1][side]overlay=${left2}:${topPadding + contentHeight}-h:format=auto[bg2]`,
    `[bg2][back]overlay=${left3}:${topPadding + contentHeight}-h:format=auto[out]`
  ].join(";");

  ensureParentDir(targetPath);
  runFfmpeg([
    "-y",
    "-i",
    sourcePaths[0],
    "-i",
    sourcePaths[1],
    "-i",
    sourcePaths[2],
    "-filter_complex",
    filter,
    "-map",
    "[out]",
    ...singleFrameOutputArgs(targetPath),
    targetPath
  ]);
  return targetPath;
}

/**
 * 功能：把正侧背三张图做 2+1 紧凑模型参考合图，正面占大面积，右侧上下分别放侧面和背面。
 * 参数：sourcePaths 按 front/side/back 顺序的三张图，targetPath 输出路径，size 目标尺寸。
 * 返回：输出文件绝对路径。
 * 异常：输入不足三张或 ffmpeg 失败时抛出异常。
 */
function createModelReferenceComposite(sourcePaths, targetPath, size, options = {}) {
  if (!Array.isArray(sourcePaths) || sourcePaths.length !== 3) {
    throw new Error("three source images are required");
  }

  const outerPaddingX = evenFloor(options.outerPaddingX || 32);
  const topPadding = evenFloor(options.topPadding || 40);
  const bottomPadding = evenFloor(options.bottomPadding || 48);
  const gap = evenFloor(options.gap || 20);
  const fullHeight = evenFloor(size.height - topPadding - bottomPadding);
  const leftWidth = evenFloor((size.width - outerPaddingX * 2 - gap) * 0.58);
  const rightWidth = evenFloor(size.width - outerPaddingX * 2 - gap - leftWidth);
  const rightCellHeight = evenFloor((fullHeight - gap) / 2);
  const leftX = outerPaddingX;
  const rightX = leftX + leftWidth + gap;
  const topRightY = topPadding;
  const bottomRightY = topPadding + rightCellHeight + gap;
  const background = options.background || DEFAULT_BACKGROUND;

  const filter = [
    backgroundSource(size, background),
    `[0:v]${fitFilter(leftWidth, fullHeight)},format=rgba[front]`,
    `[1:v]${fitFilter(rightWidth, rightCellHeight)},format=rgba[side]`,
    `[2:v]${fitFilter(rightWidth, rightCellHeight)},format=rgba[back]`,
    `[bg][front]overlay=${leftX}:${topPadding + fullHeight}-h:format=auto[bg1]`,
    `[bg1][side]overlay=${rightX}:${topRightY + rightCellHeight}-h:format=auto[bg2]`,
    `[bg2][back]overlay=${rightX}:${bottomRightY + rightCellHeight}-h:format=auto[out]`
  ].join(";");

  ensureParentDir(targetPath);
  runFfmpeg([
    "-y",
    "-i",
    sourcePaths[0],
    "-i",
    sourcePaths[1],
    "-i",
    sourcePaths[2],
    "-filter_complex",
    filter,
    "-map",
    "[out]",
    ...singleFrameOutputArgs(targetPath),
    targetPath
  ]);
  return targetPath;
}

/**
 * 功能：为三视图生成两套合图输出。
 * 参数：sourcePaths 正侧背三张图绝对路径，baseOutputPath 输出基名绝对路径，不带扩展名。
 * 返回：包含 portrait 和 square 的绝对路径结果。
 * 异常：ffmpeg 失败时抛出异常。
 */
function createThreeViewComposites(sourcePaths, baseOutputPath) {
  return {
    portrait: createModelReferenceComposite(
      sourcePaths,
      `${baseOutputPath}-1024x1536.jpg`,
      BODY_SCAN_TARGETS.portrait
    ),
    square: createModelReferenceComposite(
      sourcePaths,
      `${baseOutputPath}-1024x1024.jpg`,
      BODY_SCAN_TARGETS.square
    )
  };
}

/**
 * 功能：为抠图后的三视图生成透明底合图输出。
 * 参数：sourcePaths 正侧背三张透明 PNG 绝对路径，baseOutputPath 输出基名绝对路径，不带扩展名。
 * 返回：包含 portrait 和 square 的绝对路径结果。
 * 异常：ffmpeg 失败时抛出异常。
 */
function createThreeViewTransparentComposites(sourcePaths, baseOutputPath) {
  return {
    portrait: createPreviewComposite(
      sourcePaths,
      `${baseOutputPath}-1024x1536.png`,
      BODY_SCAN_TARGETS.portrait,
      {
        background: TRANSPARENT_BACKGROUND
      }
    ),
    square: createPreviewComposite(
      sourcePaths,
      `${baseOutputPath}-1024x1024.png`,
      BODY_SCAN_TARGETS.square,
      {
        background: TRANSPARENT_BACKGROUND
      }
    )
  };
}

module.exports = {
  BODY_SCAN_TARGETS,
  createBodyScanVariants,
  trimTransparentImage,
  createThreeViewComposites,
  createThreeViewTransparentComposites
};
