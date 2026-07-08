const zodiacColorMap = {
  "白羊座": [
    { color: "番茄红", hex: "#C94A3A", part: "唇色或小配饰", stylingHint: "用小面积红色提气场，不要全身高饱和。" },
    { color: "奶油白", hex: "#F6EBDD", part: "上衣或外套", stylingHint: "把亮度放在上半身，显得更精神。" },
    { color: "浅金", hex: "#D8B15A", part: "耳饰或项链", stylingHint: "用金属小亮点加强利落感。" }
  ],
  "金牛座": [
    { color: "燕麦米", hex: "#D8C3A5", part: "针织或半裙", stylingHint: "柔和米色适合做大面积底色。" },
    { color: "橄榄绿", hex: "#7D8A63", part: "外套或包", stylingHint: "低饱和绿色显质感，适合通勤。" },
    { color: "焦糖棕", hex: "#A9683F", part: "鞋包", stylingHint: "放在鞋包上能稳住整体风格。" }
  ],
  "双子座": [
    { color: "薄荷绿", hex: "#A9D8C2", part: "衬衫或内搭", stylingHint: "清爽色放在脸附近更轻盈。" },
    { color: "雾蓝", hex: "#A7BED3", part: "上衣或发饰", stylingHint: "雾蓝能降低跳跃感，让搭配更干净。" },
    { color: "银灰", hex: "#B7B8BA", part: "鞋包或首饰", stylingHint: "银灰适合做冷调亮点。" }
  ],
  "巨蟹座": [
    { color: "珍珠白", hex: "#F4EFE6", part: "上衣或开衫", stylingHint: "柔白色能增加亲和感。" },
    { color: "贝壳粉", hex: "#E8B9B2", part: "内搭或腮红感配饰", stylingHint: "粉色控制小面积会更成熟。" },
    { color: "浅灰蓝", hex: "#B8C7D3", part: "半裙或包", stylingHint: "灰蓝色适合温柔但不甜腻的场景。" }
  ],
  "狮子座": [
    { color: "暖金", hex: "#D6A33A", part: "耳饰或腰带", stylingHint: "用金色做焦点，避免全身太强。" },
    { color: "酒红", hex: "#8F2638", part: "包或唇色", stylingHint: "酒红适合增加存在感。" },
    { color: "奶茶棕", hex: "#B58B68", part: "外套或鞋", stylingHint: "奶茶棕能让气场更柔和。" }
  ],
  "处女座": [
    { color: "鼠尾草绿", hex: "#A9B59A", part: "衬衫或外套", stylingHint: "干净低饱和，适合精致通勤。" },
    { color: "米灰", hex: "#D7D0C4", part: "裤装或半裙", stylingHint: "米灰适合作为基础色。" },
    { color: "雾白", hex: "#F1EEE8", part: "内搭", stylingHint: "雾白能让层次更轻。" }
  ],
  "天秤座": [
    { color: "雾蓝", hex: "#A7BED3", part: "上衣或包", stylingHint: "雾蓝适合放在上半身，显得温柔清醒。" },
    { color: "玫瑰粉", hex: "#D9A1A8", part: "配饰或内搭", stylingHint: "小面积玫瑰粉有亲和力，不显幼态。" },
    { color: "奶油白", hex: "#F5E8D7", part: "外套或鞋", stylingHint: "奶油白能平衡整体色调。" }
  ],
  "天蝎座": [
    { color: "深葡萄紫", hex: "#5D3A5F", part: "包或上衣", stylingHint: "深紫适合低调但有记忆点的造型。" },
    { color: "墨黑", hex: "#222222", part: "鞋包或下装", stylingHint: "黑色放在下半身更稳。" },
    { color: "冷银", hex: "#C4C7CC", part: "首饰", stylingHint: "冷银能增加清冷感。" }
  ],
  "射手座": [
    { color: "牛仔蓝", hex: "#4F79A8", part: "外套或下装", stylingHint: "牛仔蓝适合松弛日常。" },
    { color: "奶油黄", hex: "#F0D98A", part: "内搭或包", stylingHint: "黄色小面积更轻快。" },
    { color: "苔藓绿", hex: "#7B8B52", part: "外套", stylingHint: "苔藓绿适合户外感但不粗糙。" }
  ],
  "摩羯座": [
    { color: "深灰", hex: "#5F6368", part: "外套或裤装", stylingHint: "深灰显专业，不压肤色。" },
    { color: "海军蓝", hex: "#263E63", part: "西装或包", stylingHint: "海军蓝适合正式场景。" },
    { color: "羊绒驼", hex: "#B99A75", part: "大衣或鞋", stylingHint: "驼色能让正式感更温和。" }
  ],
  "水瓶座": [
    { color: "冰蓝", hex: "#BFDDEA", part: "衬衫或配饰", stylingHint: "冰蓝有未来感，适合干净版型。" },
    { color: "银白", hex: "#E5E6E8", part: "鞋包", stylingHint: "银白适合做冷调亮点。" },
    { color: "灰紫", hex: "#A89BB4", part: "内搭", stylingHint: "灰紫比亮紫更耐看。" }
  ],
  "双鱼座": [
    { color: "海盐蓝", hex: "#AFCAD0", part: "上衣或半裙", stylingHint: "海盐蓝能增加柔和清透感。" },
    { color: "淡樱粉", hex: "#EBC4C8", part: "内搭或发饰", stylingHint: "淡粉做点缀更日常。" },
    { color: "月光白", hex: "#F7F1E8", part: "外套或鞋", stylingHint: "白色能让整体更轻盈。" }
  ]
};

const zodiacAliases = {
  "白羊": "白羊座",
  "金牛": "金牛座",
  "双子": "双子座",
  "巨蟹": "巨蟹座",
  "狮子": "狮子座",
  "处女": "处女座",
  "天秤": "天秤座",
  "天蝎": "天蝎座",
  "射手": "射手座",
  "摩羯": "摩羯座",
  "水瓶": "水瓶座",
  "双鱼": "双鱼座"
};

function normalizeZodiac(zodiac = "") {
  const value = String(zodiac || "").trim();
  return zodiacColorMap[value] ? value : (zodiacAliases[value] || "天秤座");
}

function dateKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return dateKey(new Date());
  return `${value.getFullYear()}-${value.getMonth() + 1}-${value.getDate()}`;
}

function stableIndex(seed, size) {
  const text = String(seed || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return size ? hash % size : 0;
}

function luckyColorForZodiac(zodiac = "", date = new Date()) {
  const normalizedZodiac = normalizeZodiac(zodiac);
  const colors = zodiacColorMap[normalizedZodiac] || zodiacColorMap["天秤座"];
  const key = dateKey(date);
  const selected = colors[stableIndex(`${key}-${normalizedZodiac}`, colors.length)];
  return {
    zodiac: normalizedZodiac,
    dateKey: key,
    color: selected.color,
    hex: selected.hex,
    part: selected.part,
    stylingHint: selected.stylingHint,
    source: "本地星座幸运色知识库"
  };
}

module.exports = {
  zodiacColorMap,
  luckyColorForZodiac,
  normalizeZodiac
};
