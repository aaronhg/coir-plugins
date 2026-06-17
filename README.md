# coir-plugins

[coir](https://github.com/aaronhg/coir) 的範例外掛集 —— 把「以字串名稱於執行期載入」的動態依賴灰區，補成可查的依賴邊。

每個檔案是**一個 plugin、`export default` 一個 plugin 物件**，零相依、零 build step（只用 `ctx`，型別走 `import('coir').Plugin`）。這些是**模板**：直接拿來用，或改頂端 `── configure ──` 區塊對到你專案的命名。

## 外掛一覽

| 檔案 | name | 做什麼 | 要設定的 |
|---|---|---|---|
| [`audio-call.mjs`](audio-call.mjs) | `audio-call` | 掃 component 原始碼，把 `playAudio('bgm_title')` 之類的呼叫連到同名音檔（`.mp3`/`.ogg` 皆可）→ 邊 `腳本 → 音檔` | `FUNCS`：你專案的播放函式名 |
| [`i18n-label.mjs`](i18n-label.mjs) | `i18n-label` | 把 prefab/scene 裡 i18n label 元件的 dot-path key（如 `MODULE.some_key`）連到定義該 key 的 `lang.json` → 邊 `prefab/scene → lang.json` | `COMPONENT`／`KEY_PROP`／`LANG_FILE`、`isLangFile()` |
| [`resources-sprite.mjs`](resources-sprite.mjs) | `resources-sprite` | 把以 frame 名稱（序列化的 `keys: string[]`）於執行期取圖的元件，連到含該 frame 的 sprite-atlas → 邊 `prefab/scene → atlas`（再由內建 atlas 外掛接到底圖，補完 `scene → atlas → png`） | `COMPONENTS`／`KEYS_PROP` |

> 三個外掛皆只看得到 **component 腳本**（純 util 模組在邊產生前已被剪枝）、只解**字串字面值**（變數／enum 無法靜態追蹤），撞名會連到全部同名目標 —— 屬刻意的設計取捨。

## 載入方式

### 1. `--plugin <檔>`（該次查詢，可重複）

```bash
coir -C <你的專案> --plugin ./audio-call.mjs --plugin ./i18n-label.mjs uses audio/bgm_title.mp3 --where
```

### 2. 放進 `coir.plugins.mjs`（自動載入）

coir 會自動載入 **coir 根**（全域、跨專案）與 **被掃描專案根**（只該專案）的 `coir.plugins.mjs`，其 `default` 匯出一個 plugin 或一個陣列。把這裡要的外掛 re-export 出去即可：

```js
// <你的專案>/coir.plugins.mjs
import audioCall from './path/to/coir-plugins/audio-call.mjs';
import i18nLabel from './path/to/coir-plugins/i18n-label.mjs';
export default [audioCall, i18nLabel];
```

> 全域／專案的 `coir.plugins.mjs` 在 **CLI、瀏覽器、Cocos 擴充**都會自動載入；用 `--plugin` 則只在該次 CLI/MCP 查詢生效。詳見 coir 主 repo 的「外掛」一節。

## 寫自己的外掛

外掛契約（型別／邊／命令）與 `ctx` API 見 coir 主 repo 的 **[外掛](https://github.com/aaronhg/coir#外掛擴充型別邊與命令)** 一節與 `types/index.d.ts`。
