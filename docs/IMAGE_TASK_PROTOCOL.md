# 绫崇矑鐢熷浘浠诲姟鎺ュ彛鍗忚 V1

## 鐩爣

褰撳墠闃舵涓嶇洿鎺ヨ灏忕▼搴忚皟鐢ㄥ浘鍍忕敓鎴愭湇鍔°€傛祦绋嬪厛璁捐鎴愨€滃悗绔敓鎴愪换鍔?+ 浜哄伐鎴栨湇鍔＄敓鎴愬浘鐗?+ 鍥炲～鍥剧墖鍦板潃鈥濓細

```text
鍓嶇鎻愪氦鍦烘櫙
鈫?鍚庣鐢熸垚绌挎惌鏂规鍜?image_job
鈫?浣犳寜 prompt 鐢熸垚鍥剧墖
鈫?鍥剧墖鏀惧叆鎸囧畾鐩綍鎴栦笂浼犲瓨鍌?鈫?鍚庣灏嗕换鍔℃爣璁?ready
鈫?鍓嶇灞曠ず image_url
```

杩欐牱鍙互鍏堥獙璇佸缇庛€佺増寮忓拰鎺ㄨ崘閫昏緫锛屽啀鎺ユ寮忚嚜鍔ㄧ敓鍥俱€?
## gpt-image-2 鎺ュ叆鏂瑰紡

浣犳彁渚涚殑鏂囨。鍦板潃锛?
```text
https://www.moxing.pro/docs/models/gpt-image-2
```

璇锋眰鍦板潃锛?
```text
POST https://www.moxing.pro/v1/media/generations
```

閴存潈锛?
```text
Authorization: Bearer ${MOXING_API_KEY}
```

API Key 鍙兘鏀惧湪鍚庣鐜鍙橀噺閲岋紝涓嶈兘鍐欏叆灏忕▼搴忋€佷唬鐮佷粨搴撴垨鏂囨。銆?
鍚庣 provider 璇锋眰锛?
```json
{
  "capability": "image_generation",
  "model": "gpt-image-2",
  "n": 1,
  "prompt": "string",
  "quality": "medium",
  "response_format": "url",
  "size": "1024x1536"
}
```

鏈」鐩凡鏂板 provider adapter锛?
```text
backend/providers/moxing-image.js
```

瀹冭礋璐ｆ妸鍐呴儴 `image_job` 杞崲涓?moxing 璇锋眰锛屽苟浠庡搷搴斾腑鎻愬彇鍥剧墖 URL銆?
## 浠诲姟鐘舵€?
```text
pending  寰呯敓鎴?submitted 宸叉彁浜ょ粰鏈嶅姟鍟?ready    鍥剧墖宸插洖濉?failed   鐢熸垚澶辫触
```

## GET /api/image-jobs

鏌ヨ鐢熷浘浠诲姟銆?
Query锛?
| 瀛楁 | 绫诲瀷 | 蹇呭～ | 璇存槑 |
| --- | --- | --- | --- |
| status | string | 鍚?| pending / ready / failed |

杩斿洖锛?
```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "user-a-office",
        "status": "pending",
        "provider": "moxing",
        "model": "gpt-image-2",
        "userId": "user-a",
        "userName": "灏忎簣",
        "scene": "涓婄彮",
        "outfitTitle": "钖勫濂?+ 娓呯埥鍐呮惌",
        "targetPath": "/packages/test-assets/generated/users/user-a-office.png",
        "prompt": "...",
        "negativePrompt": "...",
        "size": {
          "width": 1024,
          "height": 1536
        },
        "imageUrl": "",
        "createdAt": "2026-05-26T00:00:00.000Z",
        "updatedAt": "2026-05-26T00:00:00.000Z"
      }
    ]
  }
}
```

## POST /api/image-jobs

鍒涘缓鍗曚釜鐢熷浘浠诲姟銆?
璇锋眰锛?
```json
{
  "userId": "user-a",
  "scene": "涓婄彮"
}
```

杩斿洖锛氬崟涓?`image_job`銆?
## POST /api/image-jobs/seed-test-users

涓€娆℃€х敓鎴愬綋鍓?5 涓祴璇曠敤鎴风殑鐢熷浘浠诲姟銆?
鐢ㄤ簬鍐呴儴娴嬭瘯锛屼笉缁欐寮忕敤鎴疯皟鐢ㄣ€?
杩斿洖锛?
```json
{
  "code": 0,
  "data": {
    "items": []
  }
}
```

## POST /api/image-jobs/:id/complete

鍥炲～鐢熸垚瀹屾垚鐨勫浘鐗囥€?
璇锋眰锛?
```json
{
  "imageUrl": "/packages/test-assets/generated/users/user-a-office.png",
  "targetPath": "/packages/test-assets/generated/users/user-a-office.png"
}
```

杩斿洖锛氭洿鏂板悗鐨?`image_job`銆?
## POST /api/image-jobs/:id/submit

鎻愪氦鍗曚釜 pending 浠诲姟鍒?moxing `gpt-image-2`銆?
鍚庣瑕佹眰锛?
```text
MOXING_API_KEY=浣犵殑 key
```

濡傛灉 moxing 鍚屾杩斿洖鍥剧墖 URL锛屼换鍔＄姸鎬佸彉涓?`ready`锛屽苟鍐欏叆 `imageUrl`銆?
濡傛灉 moxing 杩斿洖寮傛浠诲姟锛?
```json
{
  "object": "media.task",
  "status": "queued",
  "task_id": "..."
}
```

浠诲姟鐘舵€佷繚鎸佷负 `queued` / `submitted`锛屽苟鍐欏叆 `providerTaskId`锛岄渶瑕佺户缁疆璇€?
澶辫触鍚庝换鍔＄姸鎬佸彉涓?`failed`锛屽苟鍐欏叆 `errorMessage`銆?
## POST /api/image-jobs/run-pending

鎵归噺鎻愪氦鎵€鏈?`pending` 浠诲姟銆?
浠呭缓璁唴閮ㄦ祴璇曚娇鐢紝姝ｅ紡鐜搴旀敼涓洪槦鍒楁墽琛屽櫒锛岄伩鍏嶄竴娆℃€цЕ鍙戝お澶氱敓鍥捐姹傘€?
## POST /api/image-jobs/:id/poll

杞鍗曚釜宸叉彁浜や换鍔°€?
杞瀹樻柟璺緞锛?
```text
GET https://www.moxing.pro/v1/media/tasks/:task_id
```

浠?moxing 鏂囨。涓哄噯锛屽綋鍓嶅疄鐜颁娇鐢細

```text
GET /v1/media/tasks/:task_id
```

鐘舵€佹槧灏勶細

| moxing status | 鏈」鐩姸鎬?|
| --- | --- |
| queued | queued |
| running | running |
| succeeded | ready |
| failed | failed |

鎴愬姛鏃朵粠鍝嶅簲 `data[].url` 鎴栧吋瀹?URL 瀛楁涓彁鍙栧浘鐗囧湴鍧€銆?
濡傛灉鍚庣画鏂囨。鍙樻洿锛屽彧闇€瑕佷慨鏀癸細

```text
backend/providers/moxing-image.js
```

## POST /api/image-jobs/poll-submitted

鎵归噺杞鎵€鏈?`submitted` / `queued` / `processing` 鐘舵€佷换鍔°€?
## POST /api/image-jobs/:id/fail

鏍囪澶辫触銆?
璇锋眰锛?
```json
{
  "message": "浜虹墿澶撮儴琚鍒囷紝闇€瑕侀噸鐢熸垚"
}
```

## 鍚庣画姝ｅ紡鍖?
姝ｅ紡鎺ュ叆 gpt-image-2 鏃跺鍔狅細

- 鐜鍙橀噺锛歚MOXING_API_KEY`
- 闃熷垪鎵ц鍣細杞 pending 浠诲姟骞惰皟鐢?provider
- 鍥剧墖瀛樺偍锛歄SS / COS / S3
- 鍥炶皟鎴栬疆璇細鐢熸垚瀹屾垚鍚庡啓鍏?`imageUrl`

灏忕▼搴忓彧鍏冲績锛?
```text
generation.tryOnImage
```

涓嶇洿鎺ュ叧蹇冨浘鍍忔湇鍔″晢銆?
## 鍥剧墖钀界洏绛栫暐

moxing 鎴愬姛鍚庤繑鍥炶繙绋?URL銆傚悗绔笉浼氳灏忕▼搴忛暱鏈熶緷璧栬 URL锛岃€屾槸鎶婂浘鐗囦笅杞藉埌浠诲姟鐨?`targetPath`銆?
瀛楁鍚箟锛?
| 瀛楁 | 璇存槑 |
| --- | --- |
| remoteImageUrl | moxing 杩斿洖鐨勫師濮嬪浘鐗?URL |
| imageUrl | 灏忕▼搴忓彲浣跨敤鐨勬湰鍦拌祫婧愯矾寰?|
| targetPath | 鍥剧墖搴斾繚瀛樺埌鐨勯」鐩矾寰?|
| localImageBytes | 宸茶惤鐩樺浘鐗囧ぇ灏?|

褰撳墠娴嬭瘯鍥剧洰鏍囪矾寰勭ず渚嬶細

```text
/packages/test-assets/generated/users/user-a-office.png
```

杞鎺ュ彛鍦ㄤ换鍔″彉涓?`ready` 鏃朵細鑷姩涓嬭浇鍥剧墖锛?
```text
POST /api/image-jobs/:id/poll
```

濡傛灉宸茬粡鏈?`remoteImageUrl`锛屼篃鍙互鎵嬪姩瑙﹀彂涓嬭浇锛?
```text
POST /api/image-jobs/:id/download
```

涓嬭浇鎴愬姛鍚庯紝浠诲姟浼氬彉涓猴細

```json
{
  "status": "ready",
  "remoteImageUrl": "https://...",
  "imageUrl": "/packages/test-assets/generated/users/user-a-office.png",
  "localImageBytes": 123456
}
```

## V1.1 鎵ц琛ュ厖锛氫腑绛夎川閲忕敓鎴愩€侀€忔槑 PNG 涓?Prompt 鍚堝悓

褰撳墠鎵€鏈夎嚜鍔ㄦ彁浜ゅ埌 moxing 鐨勮姹傚浐瀹氫娇鐢細

```json
{
  "model": "gpt-image-2",
  "quality": "medium",
  "response_format": "url",
  "size": "1024x1536"
}
```

鐢熸垚鍥句紭鍏堣姹傞€忔槑鑳屾櫙 PNG 浜虹墿鍥撅紝閬垮厤鍜岄椤电背鑹?/ 绮夎壊 / 閰风偒涓婚鑳屾櫙鍐茬獊銆侾rompt 蹇呴』鍖呭惈锛?
```text
transparent-background PNG cutout, alpha channel, person and outfit only, no room, no wall, no floor, no street
```

鐢熸垚璐ㄩ噺鍙互璋冩暣锛屼絾浜虹墿鍜岃韩鏉愪俊鎭笉鑳界渷銆傚悗绔?`image_job` 蹇呴』甯?`promptContract`锛屾彁浜ゅ墠鏍￠獙浠ヤ笅瀛楁锛?
```text
ageRange / city / heightCm / weightKg / bodyType / strategies / avoid / scene / outfitTitle / favoriteColors
```

濡傛灉缂哄瓧娈碉紝浠诲姟鐘舵€佸彉涓猴細

```text
incomplete
```

骞跺啓鍏ワ細

```json
{
  "promptContractStatus": "invalid",
  "promptContractMissing": ["heightCm", "weightKg"],
  "errorMessage": "image prompt contract missing: heightCm, weightKg"
}
```

瀵瑰簲瀹屾暣瑙勮寖瑙侊細

```text
docs/IMAGE_GENERATION_CONTRACT.md
```
