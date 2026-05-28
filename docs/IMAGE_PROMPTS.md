# 米粒测试用户生图任务 V2

## 这版提示词的目标

上一版偏“人物资料说明”，容易生成僵硬、普通、像证件式试衣图的女孩。

这一版改成“时尚穿搭摄影指令”：

- 先定义画面类型：真实街拍 / 小红书穿搭 / 时尚编辑感。
- 再定义人物状态：自然、有动作、有生活场景，不是站军姿。
- 再定义穿搭策略：比例、颜色、场景、材质。
- 最后定义约束：不影楼、不婚纱、不夸张改身材、不裁头脚。

## 输出要求

图片原始生成后可以先放到：

```text
assets/generated/users/
```

为了避免微信主包 2MB 限制，当前测试图已迁移到分包目录：

```text
packages/test-assets/generated/users/
```

文件名必须严格一致：

```text
user-a-office.png
user-b-office.png
user-c-shopping.png
user-d-party.png
user-e-dating.png
```

推荐规格：

- PNG。
- 透明背景优先；如果无法透明，使用干净但有生活感的浅色背景。
- 竖图，全身，头脚完整。
- 人物要自然、有动作，不要僵硬正站。
- 女孩要有真实普通人的亲近感，但穿搭必须有时尚完成度。
- 不要统一生成网红脸，不要过度美颜，不要过度拉腿。

统一负面约束：

```text
no stiff pose, no passport photo pose, no wedding studio style, no luxury studio portrait, no old fashioned outfit, no heavy makeup, no over-retouched skin, no exaggerated body reshaping, no unrealistic long legs, no overly sexy styling, no cropped head, no cropped feet, no deformed hands, no extra fingers, no messy background, no runway dress, no evening gown
```

## 1. user-a-office.png

用户：小予，25 岁，上海，164cm / 50kg，天秤座。窄肩，梨形偏沙漏，腿长较好，腰线清楚。场景：上班。

设计目标：清爽通勤，有轻杂志感，温柔但有边界感。

提示词：

```text
Create a full-body realistic fashion editorial street-style photo of a young Chinese woman on a weekday morning in Shanghai, natural and approachable, not model-perfect. She is 25, 164cm, slim pear-hourglass figure with narrow shoulders, defined waist, slightly fuller hips, good leg proportion. 

She is walking slowly out of a bright office lobby, one hand lightly holding a small beige handbag, the other hand adjusting the edge of her short blazer, relaxed confident expression, natural imperfect posture, alive and candid.

Outfit: cropped cream-white structured blazer with clean shoulder line, sage green fitted knit tank, high-waisted straight dark indigo jeans, slim black mary jane flats. Styling should raise the waistline and define the shoulder line without looking formal or old. 

Fashion direction: 2026 Xiaohongshu clean commute style, Korean clean fit, light French simplicity, low-saturation mist blue and sage mood, realistic fabric texture, soft daylight, airy composition, full body visible from head to shoes, transparent background if possible or minimal warm office background.
```

## 2. user-b-office.png

用户：阿宁，31 岁，杭州，158cm / 56kg。小个子，肩窄，腰腹容易显厚。场景：上班。

设计目标：显高，干净不幼稚，轻熟但不老气。

提示词：

```text
Create a full-body realistic daily fashion photo of a Chinese woman in her early 30s, petite 158cm, 56kg, narrow shoulders, soft waist and abdomen, realistic ordinary body, not skinny and not model-like.

She is standing near a cafe entrance before work, slightly turning her body, one foot stepping forward, holding a takeaway coffee and a small structured bag. Her expression is calm, warm, and intelligent, like a real office woman with good taste.

Outfit: cropped light beige jacket ending above the hip, ivory V-neck inner top, high-waisted ankle-length straight trousers in warm light gray, pointed low-heel nude flats. The silhouette must visually lengthen her legs, keep the waistline high, expose the ankle, and avoid bulky layers.

Fashion direction: modern Chinese office commute, clean mature but not old-fashioned, gentle Hangzhou city mood, soft morning light, subtle beige-gray-pink palette, realistic fabric, polished but wearable, full body visible, transparent background if possible or clean cafe street background.
```

## 3. user-c-shopping.png

用户：小夏，22 岁，成都，168cm / 62kg。高个，胯宽，大腿有肉。场景：逛街。

设计目标：松弛时髦，修饰下半身，上半身有亮点。

提示词：

```text
Create a full-body realistic trendy street-style photo of a young Chinese woman shopping in Chengdu, 22 years old, 168cm, healthy realistic body, wider hips and fuller thighs, confident and lively, not thin, not over-shaped.

She is walking through a relaxed shopping street, slightly swinging a crossbody bag, looking to the side as if seeing a window display. The pose should feel spontaneous, energetic, and fashionable, not stiff.

Outfit: slightly cropped relaxed light blue shirt worn open, cream fitted tank top, high-waisted drapey wide-leg trousers in deep denim or charcoal blue, slim comfortable sneakers or loafers, small crossbody bag. The outfit should place visual interest on the upper body, keep the lower body smooth and vertical, and avoid tight light-colored pants.

Fashion direction: 2026 Xiaohongshu casual chic, relaxed Korean street style, Chengdu weekend mood, denim blue, cream, soft gray-green accents, realistic fabric flow, movement in the shirt hem and trousers, full body visible, transparent background if possible or clean urban shopping background.
```

## 4. user-d-party.png

用户：若晴，35 岁，北京，162cm / 60kg。上半身偏丰满，手臂肉感明显，腰线不够明显。场景：聚会。

设计目标：利落、有质感、不显壮，成熟但不老气。

提示词：

```text
Create a full-body realistic fashion photo of a Chinese woman in her mid 30s going to a dinner party in Beijing, 162cm, 60kg, realistic curvy upper body, fuller bust and arms, soft waist, normal legs. She should look elegant, grounded, and modern, not overly glamorous.

She is entering a warm modern restaurant or gallery lounge, body slightly angled, one hand holding a small clutch, the other hand naturally near the blazer opening. Expression composed and relaxed, not posing too hard.

Outfit: open-front dark charcoal lightweight longline blazer or structured cardigan creating vertical lines, wine-red V-neck satin-matte inner top, high-waisted clean black straight midi skirt or tailored dark trousers, refined low heels, small metallic earrings. Avoid high neck, puff sleeves, chest-heavy decoration, shiny evening gown feeling.

Fashion direction: modern mature Chinese party outfit, quiet luxury but daily wearable, Beijing evening social scene, wine red and charcoal palette, vertical lines to reduce upper-body heaviness, realistic fabric texture, full body visible, transparent background if possible or tasteful warm restaurant background.
```

## 5. user-e-dating.png

用户：林一，28 岁，深圳，155cm / 47kg。小个子，腿比偏短，肩背薄，腰细。场景：约会。

设计目标：显高，轻甜但不幼稚，避免拖地裤和厚重鞋。

提示词：

```text
Create a full-body realistic soft dating outfit photo of a Chinese woman in Shenzhen, late 20s, petite 155cm, 47kg, thin shoulders and back, slim waist, shorter leg proportion, ordinary realistic body, approachable and lively.

She is standing outside a bright brunch cafe or near a clean street corner, slightly leaning forward with a small smile, one hand holding a mini shoulder bag, one foot stepping ahead. The pose should make her feel vivid and natural, not like a mannequin.

Outfit: cropped cream cardigan or short light jacket, soft light blue fitted inner top, high-waisted warm beige A-line mini skirt or above-knee skirt, delicate slim mary jane flats or light ballet flats, small shoulder bag. The styling should raise the waistline, keep the shoes light, and make the legs look longer without unrealistic body stretching.

Fashion direction: Korean light dating style, clean Xiaohongshu spring-summer outfit, sweet but not childish, cream, light blue and almond palette, soft daylight, realistic texture, full body visible from head to shoes, transparent background if possible or minimal bright cafe background.
```

## 备用：更强时尚感版本

如果 Image2 生成结果仍然普通，可以把每张提示词最后追加：

```text
Make the styling look like a high-quality Xiaohongshu fashion creator's outfit post, with intentional layering, polished accessories, natural movement, editorial composition, and a clear sense of personal style. The girl should look vivid, socially real, and fashionable, not like a catalog model.
```

## 前端接入说明

当前前端通过测试资产分包读取图片。确认 5 张图放入 `packages/test-assets/generated/users/` 后，将：

```text
services/mock-server.js
```

里的：

```js
const USE_MANUAL_TEST_IMAGES = false;
```

改成：

```js
const USE_MANUAL_TEST_IMAGES = true;
```

前端就会使用这 5 张测试图。
