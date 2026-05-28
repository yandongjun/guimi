const user = {
  id: "demo-user",
  nickname: "小予",
  avatar: "",
  city: "上海",
  zodiac: "天秤座",
  height: 164,
  weight: 50,
  membership: "free",
  dailyGenerationLimit: 2,
  favoriteColors: ["雾蓝", "鼠尾草绿", "奶油白"],
  dislikedColors: ["荧光色", "大面积紫色"],
  styleKeywords: ["清爽通勤", "韩系干净感", "轻法式"],
  companion: {
    name: "米粒",
    role: "不抢风头但很会穿的 AI 闺蜜",
    tone: "说话具体、不给身材压力、每条建议都有理由"
  }
};

const testUsers = [
  {
    id: "user-a",
    nickname: "小予",
    city: "上海",
    zodiac: "天秤座",
    ageRange: "23-28",
    height: 164,
    weight: 50,
    membership: "free",
    dailyGenerationLimit: 2,
    favoriteColors: ["雾蓝", "鼠尾草绿", "奶油白"],
    dislikedColors: ["荧光色", "大面积紫色"],
    styleKeywords: ["清爽通勤", "韩系干净感", "轻法式"],
    scenes: ["上班", "逛街"],
    bodyProfile: {
      status: "ready",
      heightCm: 164,
      shoulderRatio: 0.92,
      waistRatio: 0.72,
      hipRatio: 0.88,
      legRatioValue: 0.53,
      headBodyRatio: 7.2,
      shoulder: "窄肩",
      waistHip: "腰臀差明显",
      legRatio: "腿长偏优",
      bodyType: "梨形偏沙漏",
      bodyTags: ["narrow_shoulder", "long_leg", "defined_waist"],
      highlights: ["腰线清楚", "腿部比例好", "适合高腰线"],
      avoid: ["低腰宽松下装", "塌肩厚针织", "大面积高饱和下装"],
      strategies: ["补肩线", "提高腰线", "下装保留垂顺感"],
      strategyTags: ["define_shoulder", "raise_waistline", "extend_leg"]
    },
    imageJob: "user-a-office"
  },
  {
    id: "user-b",
    nickname: "阿宁",
    city: "杭州",
    zodiac: "金牛座",
    ageRange: "29-35",
    height: 158,
    weight: 56,
    membership: "free",
    dailyGenerationLimit: 2,
    favoriteColors: ["米白", "浅灰", "豆沙粉"],
    dislikedColors: ["荧光色", "厚重黑"],
    styleKeywords: ["显高通勤", "干净不幼稚", "轻熟"],
    scenes: ["上班", "约会"],
    bodyProfile: {
      status: "ready",
      heightCm: 158,
      shoulderRatio: 0.9,
      waistRatio: 0.78,
      hipRatio: 0.9,
      legRatioValue: 0.49,
      headBodyRatio: 6.8,
      shoulder: "肩窄",
      waistHip: "腰腹易显厚",
      legRatio: "小个子常规腿比",
      bodyType: "小个子梨形",
      bodyTags: ["petite", "narrow_shoulder", "soft_waist"],
      highlights: ["五官量感轻", "适合短上装", "适合露脚背"],
      avoid: ["长款宽外套", "低腰裤", "横向膨胀上装"],
      strategies: ["短外套", "九分下装", "露脚背拉长"],
      strategyTags: ["petite_extend", "raise_waistline", "light_shoes"]
    },
    imageJob: "user-b-office"
  },
  {
    id: "user-c",
    nickname: "小夏",
    city: "成都",
    zodiac: "射手座",
    ageRange: "18-22",
    height: 168,
    weight: 62,
    membership: "free",
    dailyGenerationLimit: 2,
    favoriteColors: ["牛仔蓝", "奶油黄", "灰绿"],
    dislikedColors: ["玫红", "高饱和紫"],
    styleKeywords: ["松弛时髦", "休闲有型", "修饰下半身"],
    scenes: ["逛街", "聚会"],
    bodyProfile: {
      status: "ready",
      heightCm: 168,
      shoulderRatio: 0.96,
      waistRatio: 0.76,
      hipRatio: 0.94,
      legRatioValue: 0.52,
      headBodyRatio: 7.1,
      shoulder: "肩线正常",
      waistHip: "胯宽大腿有肉",
      legRatio: "腿长正常偏好",
      bodyType: "高个梨形",
      bodyTags: ["tall", "wide_hip", "full_thigh"],
      highlights: ["身高有优势", "适合长线条", "适合上半身亮点"],
      avoid: ["紧身浅色下装", "短而蓬的裙摆", "胯部复杂装饰"],
      strategies: ["上半身做重点", "下装垂顺", "鞋裤同色"],
      strategyTags: ["upper_focus", "smooth_bottom", "same_color_shoes"]
    },
    imageJob: "user-c-shopping"
  },
  {
    id: "user-d",
    nickname: "若晴",
    city: "北京",
    zodiac: "摩羯座",
    ageRange: "29-35",
    height: 162,
    weight: 60,
    membership: "free",
    dailyGenerationLimit: 2,
    favoriteColors: ["深灰", "酒红", "米白"],
    dislikedColors: ["幼态粉", "大面积碎花"],
    styleKeywords: ["利落质感", "不显壮", "成熟但不老气"],
    scenes: ["聚会", "上班"],
    bodyProfile: {
      status: "ready",
      heightCm: 162,
      shoulderRatio: 1.02,
      waistRatio: 0.8,
      hipRatio: 0.9,
      legRatioValue: 0.5,
      headBodyRatio: 6.9,
      shoulder: "肩胸存在感强",
      waistHip: "腰线不够明显",
      legRatio: "腿比正常",
      bodyType: "上半身偏丰满",
      bodyTags: ["full_upper", "soft_waist", "normal_leg"],
      highlights: ["适合利落剪裁", "适合深浅对比", "气场稳定"],
      avoid: ["高领厚针织", "泡泡袖", "胸前复杂装饰"],
      strategies: ["V领或开襟", "外套纵向线", "下半身保持简洁"],
      strategyTags: ["open_neckline", "vertical_line", "clean_bottom"]
    },
    imageJob: "user-d-party"
  },
  {
    id: "user-e",
    nickname: "林一",
    city: "深圳",
    zodiac: "双子座",
    ageRange: "23-28",
    height: 155,
    weight: 47,
    membership: "free",
    dailyGenerationLimit: 2,
    favoriteColors: ["奶油白", "浅蓝", "杏色"],
    dislikedColors: ["暗沉棕", "过重黑"],
    styleKeywords: ["显高", "轻甜不幼稚", "小个子友好"],
    scenes: ["约会", "逛街"],
    bodyProfile: {
      status: "ready",
      heightCm: 155,
      shoulderRatio: 0.88,
      waistRatio: 0.7,
      hipRatio: 0.84,
      legRatioValue: 0.47,
      headBodyRatio: 6.6,
      shoulder: "肩背薄",
      waistHip: "腰细但腿比偏短",
      legRatio: "腿比偏短",
      bodyType: "小个子直线型",
      bodyTags: ["petite", "short_leg", "thin_shoulder"],
      highlights: ["腰细", "适合短款", "轻盈感强"],
      avoid: ["拖地阔腿裤", "过长裙摆", "厚底笨重鞋"],
      strategies: ["短上衣", "高腰短裙或九分裤", "轻量鞋"],
      strategyTags: ["crop_top", "high_waist", "light_shoes"]
    },
    imageJob: "user-e-dating"
  }
];

const weather = {
  city: "上海",
  text: "舒适微风",
  dayTemp: 27,
  nightTemp: 18,
  humidity: 63,
  wind: "东南风 3 级",
  tempDiff: 9,
  tips: ["昼夜温差 9°C", "午后偏热", "晚间需要薄外套"]
};

const dailyAura = {
  zodiac: "天秤座",
  mood: "温柔但有边界感",
  luckyColor: "雾蓝",
  fortune: "今天适合把自己收拾得清爽一点，社交里不用太用力，保持松弛反而更有吸引力。",
  stylingHint: "雾蓝不用大面积穿，放在上半身、包或发饰上就够。"
};

const bodyProfile = {
  status: "ready",
  heightCm: 164,
  shoulderRatio: 0.92,
  waistRatio: 0.72,
  hipRatio: 0.88,
  legRatioValue: 0.53,
  headBodyRatio: 7.2,
  shoulder: "窄肩",
  waistHip: "腰臀差明显",
  legRatio: "腿长偏优",
  bodyType: "梨形偏沙漏",
  bodyTags: ["narrow_shoulder", "long_leg", "defined_waist"],
  highlights: ["腰线清楚", "腿部比例好", "适合高腰线"],
  avoid: ["低腰宽松下装", "塌肩厚针织", "大面积高饱和下装"],
  strategies: ["补肩线", "提高腰线", "下装保留垂顺感"],
  strategyTags: ["define_shoulder", "raise_waistline", "extend_leg"]
};

const closet = [
  {
    id: "c1",
    name: "短款奶油白西装",
    category: "outerwear",
    subCategory: "short_blazer",
    color: "奶油白",
    warmth: 2,
    formality: 4,
    sourceType: "wardrobe",
    tags: ["补肩线", "短外套", "通勤"],
    bodyStrategyTags: ["define_shoulder", "raise_waistline"],
    sceneTags: ["上班", "约会"],
    image: ""
  },
  {
    id: "c2",
    name: "鼠尾草绿针织背心",
    category: "top",
    subCategory: "knit_vest",
    color: "鼠尾草绿",
    warmth: 1,
    formality: 2,
    sourceType: "wardrobe",
    tags: ["清爽内搭", "轻复古", "显气色"],
    bodyStrategyTags: ["upper_focus"],
    sceneTags: ["上班", "出游"],
    image: ""
  },
  {
    id: "c3",
    name: "深靛直筒牛仔裤",
    category: "bottom",
    subCategory: "straight_jeans",
    color: "深靛蓝",
    warmth: 2,
    formality: 2,
    sourceType: "wardrobe",
    tags: ["高腰线", "修腿", "耐穿"],
    bodyStrategyTags: ["extend_leg"],
    sceneTags: ["上班", "出游", "聚会"],
    image: ""
  },
  {
    id: "c4",
    name: "黑色玛丽珍鞋",
    category: "shoes",
    subCategory: "mary_jane",
    color: "黑色",
    warmth: 1,
    formality: 3,
    sourceType: "wardrobe",
    tags: ["稳重", "露脚背", "百搭"],
    bodyStrategyTags: ["extend_leg"],
    sceneTags: ["上班", "约会", "聚会"],
    image: ""
  }
];

const trendItems = [
  {
    id: "t1",
    name: "微收腰短风衣",
    source: "趋势库",
    priceRange: "399-899",
    color: "浅卡其",
    tags: ["短外套", "补肩线", "春夏通勤"],
    reason: "短款和收腰能照顾梨形比例，昼夜温差也实用。"
  },
  {
    id: "t2",
    name: "低饱和薄荷绿衬衫",
    source: "趋势库",
    priceRange: "199-499",
    color: "薄荷绿",
    tags: ["清爽", "低饱和", "可外穿"],
    reason: "和雾蓝、鼠尾草绿相邻，能提气色但不抢。"
  },
  {
    id: "t3",
    name: "高腰垂感阔腿西裤",
    source: "趋势库",
    priceRange: "259-699",
    color: "米灰",
    tags: ["高腰线", "垂顺", "通勤"],
    reason: "能延长腿部比例，适合正式一点的上班场景。"
  }
];

const similarProducts = [
  {
    id: "p1",
    name: "短款浅色西装外套",
    platform: "候选链接 A",
    priceRange: "299-499",
    color: "奶油白",
    tags: ["短外套", "补肩线"],
    reason: "和今日外套版型接近，能补肩线又不压身高。"
  },
  {
    id: "p2",
    name: "微收腰薄西装",
    platform: "候选链接 B",
    priceRange: "399-699",
    color: "米白",
    tags: ["收腰", "通勤"],
    reason: "腰线更清楚，适合想要更正式一点的通勤效果。"
  },
  {
    id: "p3",
    name: "轻薄短风衣外套",
    platform: "候选链接 C",
    priceRange: "459-899",
    color: "浅卡其",
    tags: ["防风", "短款"],
    reason: "更适合温差和风大的天气，和今天的层次逻辑一致。"
  }
];

const sceneOptions = ["上班", "逛街", "约会", "聚会", "更多"];

const manualImageJobs = [
  {
    id: "user-a-office",
    userId: "user-a",
    scene: "上班",
    imagePath: "/packages/test-assets/generated/users/user-a-office.png",
    outfitTitle: "薄外套 + 清爽内搭"
  },
  {
    id: "user-b-office",
    userId: "user-b",
    scene: "上班",
    imagePath: "/packages/test-assets/generated/users/user-b-office.jpg",
    outfitTitle: "短外套 + 高腰九分裤"
  },
  {
    id: "user-c-shopping",
    userId: "user-c",
    scene: "逛街",
    imagePath: "/packages/test-assets/generated/users/user-c-shopping.jpg",
    outfitTitle: "短衬衫 + 垂感阔腿裤"
  },
  {
    id: "user-d-party",
    userId: "user-d",
    scene: "聚会",
    imagePath: "/packages/test-assets/generated/users/user-d-party.jpg",
    outfitTitle: "开襟外套 + 利落长裙"
  },
  {
    id: "user-e-dating",
    userId: "user-e",
    scene: "约会",
    imagePath: "/packages/test-assets/generated/users/user-e-dating.jpg",
    outfitTitle: "短上衣 + 高腰短裙"
  }
];

const outfitByScene = {
  "上班": {
    id: "look-office",
    scene: "上班",
    title: "薄外套 + 清爽内搭",
    displayTitle: "薄外套 + 清爽内搭",
    mood: "温柔但有边界感",
    displayMood: "温柔但有边界感",
    score: 92,
    tryOnImage: "/assets/generated/tryon-model-transparent.png",
    colorTags: ["奶油白", "鼠尾草绿", "深靛蓝"],
    visualNotes: [
      { text: "补肩线", type: "body" },
      { text: "高腰线", type: "body" }
    ],
    summaryReasons: [
      { name: "比例", copy: "优化肩胸比" },
      { name: "颜色", copy: "雾蓝提气质" },
      { name: "场景", copy: "通勤约会都稳" }
    ],
    layers: [
      { slot: "外套", name: "短款奶油白西装", source: "wardrobe", reason: "补足肩部结构，晚间降温可直接穿上。" },
      { slot: "上装", name: "鼠尾草绿针织背心", source: "wardrobe", reason: "贴近今日幸运色，低饱和不压气色。" },
      { slot: "下装", name: "深靛直筒牛仔裤", source: "wardrobe", reason: "直线条修饰腿部，保留腿长优势。" },
      { slot: "鞋包", name: "黑色玛丽珍鞋 + 小号腋下包", source: "wardrobe", reason: "露脚背轻微拉长小腿，包位靠上更显比例。" }
    ],
    reasons: [
      "天气：昼夜温差 9°C，外套要能脱，内搭单穿也要完整。",
      "比例：短外套补肩线，腰线往上提一点，保留腿长优势。",
      "颜色：雾蓝不用大面积穿，用相邻的鼠尾草绿更自然。"
    ],
    reminders: ["中午热可以脱外套。", "晚间再穿回外套，避免肩颈受凉。"],
    sourceMix: ["wardrobe"]
  },
  "约会": {
    id: "look-date",
    scene: "约会",
    title: "短外套 + 柔软裙感",
    displayTitle: "短外套 + 柔软裙感",
    mood: "轻甜但不幼态",
    displayMood: "轻甜但不幼态",
    score: 90,
    tryOnImage: "/assets/generated/tryon-model-transparent.png",
    colorTags: ["奶油白", "雾蓝", "米灰"],
    visualNotes: [
      { text: "收腰", type: "body" },
      { text: "轻配色", type: "color" }
    ],
    summaryReasons: [
      { name: "比例", copy: "腰线更清楚" },
      { name: "颜色", copy: "雾蓝点缀" },
      { name: "场景", copy: "温柔不刻意" }
    ],
    layers: [
      { slot: "外套", name: "短款奶油白西装", source: "wardrobe", reason: "保留结构感，避免约会造型过甜。" },
      { slot: "内搭", name: "低饱和薄荷绿衬衫", source: "trend_library", reason: "衣橱里缺少柔软上装，用趋势库先试一版。" },
      { slot: "下装", name: "米灰高腰半裙", source: "trend_library", reason: "高腰和 A 字线条能平衡臀胯。" }
    ],
    reasons: [
      "场景：约会需要柔和一点，但不能太用力。",
      "比例：高腰半裙能稳住腰臀比例。",
      "颜色：雾蓝只做点缀，更显干净。"
    ],
    reminders: ["如果晚上降温，保留短外套。", "包选小一点，整体会更轻。"],
    sourceMix: ["wardrobe", "trend_library"]
  },
  "聚会": {
    id: "look-party",
    scene: "聚会",
    title: "利落外套 + 亮点配饰",
    displayTitle: "利落外套 + 亮点配饰",
    mood: "有存在感但不压人",
    displayMood: "有存在感不压人",
    score: 88,
    tryOnImage: "/assets/generated/tryon-model-transparent.png",
    colorTags: ["奶油白", "深靛蓝", "银色"],
    visualNotes: [
      { text: "上移重心", type: "body" },
      { text: "小亮点", type: "style" }
    ],
    summaryReasons: [
      { name: "比例", copy: "重心上移" },
      { name: "颜色", copy: "银色提亮" },
      { name: "场景", copy: "聚会有记忆点" }
    ],
    layers: [
      { slot: "外套", name: "短款奶油白西装", source: "wardrobe", reason: "利落肩线让聚会照更精神。" },
      { slot: "下装", name: "深靛直筒牛仔裤", source: "wardrobe", reason: "比裙装更松弛，适合朋友聚会。" },
      { slot: "配饰", name: "银色细项链 / 耳饰", source: "trend_library", reason: "小面积提亮，不抢整体风格。" }
    ],
    reasons: [
      "场景：聚会需要一点亮点，但不必全身用力。",
      "比例：把亮点放上半身，能自然上移视觉重心。",
      "衣橱：已有外套和牛仔裤足够完成主结构。"
    ],
    reminders: ["拍照时外套敞开更显腰线。", "配饰控制在一到两个亮点。"],
    sourceMix: ["wardrobe", "trend_library"]
  },
  "出游": {
    id: "look-travel",
    scene: "出游",
    title: "轻外套 + 耐走下装",
    displayTitle: "轻外套 + 耐走下装",
    mood: "舒服但不随便",
    displayMood: "舒服但不随便",
    score: 89,
    tryOnImage: "/assets/generated/tryon-model-transparent.png",
    colorTags: ["浅卡其", "鼠尾草绿", "深靛蓝"],
    visualNotes: [
      { text: "轻防风", type: "weather" },
      { text: "耐走", type: "scene" }
    ],
    summaryReasons: [
      { name: "天气", copy: "外套可脱" },
      { name: "比例", copy: "保留腿长" },
      { name: "场景", copy: "耐走好拍" }
    ],
    layers: [
      { slot: "外套", name: "微收腰短风衣", source: "trend_library", reason: "衣橱里缺少防风外套，用趋势库补出游场景。" },
      { slot: "内搭", name: "鼠尾草绿针织背心", source: "wardrobe", reason: "单穿完整，午后热也不尴尬。" },
      { slot: "下装", name: "深靛直筒牛仔裤", source: "wardrobe", reason: "耐走耐拍，线条也干净。" }
    ],
    reasons: [
      "天气：早晚温差大，轻外套比厚外套更灵活。",
      "场景：出游要耐走，鞋和裤子优先实用。",
      "比例：短外套不会压身高。"
    ],
    reminders: ["包选斜挎或腋下包，手会更自由。", "如果走路多，换低跟或平底鞋。"],
    sourceMix: ["wardrobe", "trend_library"]
  }
};

const evaluation = {
  totalScore: 86,
  summary: "整体比例是对的，腰线还可以再明确一点。",
  evidence: [
    {
      title: "比例",
      score: 90,
      detail: "下装线条干净，腿部长度被保留下来了；腰线如果再上移一点，会更显高。"
    },
    {
      title: "颜色",
      score: 84,
      detail: "主色温柔，和肤色冲突不大；鞋包如果统一深色，整体会更稳。"
    },
    {
      title: "场景",
      score: 82,
      detail: "适合通勤和约会前半段，正式会议可以增加一件有肩线的外套。"
    }
  ],
  actions: ["把上衣前摆塞 1/3。", "加短外套或挺括马甲。", "把包背到腰线以上。"],
  closetCandidates: ["鼠尾草绿针织背心", "短款奶油白西装"]
};

module.exports = {
  user,
  testUsers,
  weather,
  dailyAura,
  bodyProfile,
  closet,
  trendItems,
  similarProducts,
  sceneOptions,
  manualImageJobs,
  outfitByScene,
  dailyOutfit: outfitByScene["上班"],
  evaluation
};
