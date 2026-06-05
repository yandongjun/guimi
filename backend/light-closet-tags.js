const dictionaries = {
  category: {
    outerwear: "外套",
    top: "上衣",
    bottom: "下装",
    dress: "连衣裙",
    shoes: "鞋",
    bag: "包",
    accessory: "配饰"
  },
  scene: {
    office: "上班",
    dating: "约会",
    party: "聚会",
    travel: "出游",
    shopping: "逛街",
    daily: "日常"
  },
  color: {
    cream_white: "奶油白",
    mist_blue: "雾蓝",
    sage_green: "鼠尾草绿",
    denim_blue: "牛仔蓝",
    dark_indigo: "深靛蓝",
    black: "黑色",
    beige: "米色",
    grey: "灰色",
    blush_pink: "豆沙粉"
  },
  style: {
    clean_fit: "干净感",
    commute: "通勤",
    korean: "韩系",
    minimal: "极简",
    light_mature: "轻熟",
    relaxed: "松弛感",
    sweet_light: "轻甜"
  },
  bodyStrategy: {
    define_shoulder: "补肩线",
    raise_waistline: "提高腰线",
    extend_leg: "拉长腿部比例",
    petite_extend: "小个子显高",
    light_shoes: "轻量鞋",
    upper_focus: "上半身做重点",
    smooth_bottom: "下装保持垂顺",
    same_color_shoes: "鞋裤同色",
    crop_top: "短上衣",
    high_waist: "高腰线",
    open_neckline: "打开领口",
    vertical_line: "增加纵向线条",
    clean_bottom: "下半身保持简洁"
  },
  risk: {
    press_height: "压身高",
    widen_hip: "显胯宽",
    too_mature: "偏成熟",
    too_sweet: "偏甜",
    too_heavy: "偏厚重"
  }
};

function labelFor(type, key) {
  return (dictionaries[type] && dictionaries[type][key]) || String(key || "");
}

function labelsFor(type, keys = []) {
  return (Array.isArray(keys) ? keys : [])
    .map((key) => labelFor(type, key))
    .filter(Boolean);
}

function knownKeys(type) {
  return Object.keys(dictionaries[type] || {});
}

module.exports = {
  dictionaries,
  labelFor,
  labelsFor,
  knownKeys
};
