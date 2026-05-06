---
name: add-scene
description: 把一张（或多张）新场景图加入 scene-library 的完整 SOP。覆盖：图片落盘 → 自动打标 + 人工补标 → 写入 scripts/scene-library.json → 匹配自检 → 可选 fusion 回归。当用户说"加一张场景"、"把这张图加到场景库"、"导入 N 张新 beach 场景"等时触发。
---

# /add-scene — 添加新场景到场景库

你（主 Claude）按下面的步骤把用户给的图加进 scene-library。**每一步完成都向用户确认进度**，**任何写文件操作前先告诉用户要写什么**。

## 0. 项目坐标（先记住）

- 场景图片目录：`public/scene-library/`（命名规则：`<category>_NN.jpg`，NN 是两位数从 01 开始）
- 场景元数据：`scripts/scene-library.json`（数组，元素结构见下）
- SceneEntry 类型定义：`app/api/enhance-photo/match-scene.ts:8-20`
- 匹配逻辑：同上文件，三级 fallback
- 用户 SceneTags 类型：`app/api/scanner/tag-prompt.ts:30-35`
- Fusion 回归脚本：`npm run test:fusion`（脚本入口 `scripts/scene-fusion-test.ts`）

## 1. 收集输入

向用户确认以下信息（如果消息里没给齐就一次性问完，不要来回挤牙膏）：

1. **图片来源**：本地路径 / URL / 或者用户直接粘到对话里的 attachment
2. **批量还是单张**：单张走完整流程；多张则对每张重复 step 2-5，最后统一 step 6-7
3. **预期的 scene_category**（如果用户没说，看图后建议一个；可复用现有：从 `scripts/scene-library.json` grep `"scene_category"` 看已有哪些类别）

## 2. 自动打标（你直接看图）

**关键省钱点**：你（主 Claude）是多模态模型，能直接 Read 图片。**不要**调 Gemini API 来打标——浪费钱也慢。

直接用 Read 工具读图（Read 支持 jpg/png），然后按 SceneEntry schema 输出标签初稿。每个字段的取值范围：

| 字段 | 取值 | 你判断的依据 |
|---|---|---|
| `color_temperature` | `warm` / `neutral` / `cool` | 图里的中性色（白墙、白桌）偏黄/橙=warm；干净白=neutral；偏蓝=cool |
| `light_direction` | `left` / `right` / `front` / `top` / `back` / `ambient` | 看场景里物体阴影方向；阴影在右侧 → 光从左；散射无方向 → ambient |
| `light_intensity` | `harsh` / `soft` / `dim` | 阴影边缘锐利+高反差=harsh；柔和过渡=soft；整体暗=dim |
| `background_complexity` | `simple` / `moderate` / `busy` | 干净背景（纯墙/天空）=simple；几个物件=moderate；满构图=busy |
| `subject_slot` | `center` / `left` / `right` | 场景里**留白**的位置——即人应该站在哪。如果场景中央有空椅子，slot=center；如果右侧是空旷的，slot=right |
| `recommended_person_size` | `close` / `medium` / `far` | 看场景适合人占画幅多大（参考 `getSizeGuidance` in `route.ts:489-496`：close=40-60%, medium=30-45%, far=15-30%）。空间局促 → close；中景空间 → medium；广阔风景 → far |
| `person_scale_reference` | `has_reference` / `no_reference` | 场景里有没有可以推断人体尺度的标准物（椅子、门、桌、车）。有 → has_reference |

**人工裁决字段**（你给建议，但必须让用户拍板）：
- `scene_category`：复用现有类别优先，新建要谨慎（grep 现有 `scene_category` 列表给用户挑）
- `vibe`：现有库已有的（如 intellectual / romantic / adventurous 等，grep 一下），让用户在已有 vibe 里选或新建

输出格式给用户看（一张图一份）：

```json
{
  "id": "<category>_NN",       // NN 待确定
  "file": "<category>_NN.jpg",
  "color_temperature": "...",   // 自动
  "light_direction": "...",     // 自动
  "light_intensity": "...",     // 自动
  "recommended_person_size": "...",  // 自动 + 让用户确认
  "person_scale_reference": "...",   // 自动
  "background_complexity": "...",    // 自动
  "subject_slot": "...",             // 自动 + 让用户确认
  "scene_category": "<待用户确认>",
  "vibe": "<待用户确认>"
}
```

明确告诉用户：**"自动判断了 7 个字段，请确认 + 补两个："**，然后等用户回复。

## 3. 确定文件名 + 落盘

用户确认 category 后：

1. Glob `public/scene-library/<category>_*.jpg` 拿到现有最大 NN，新文件用 NN+1（两位数补零）
2. 把图复制到 `public/scene-library/<category>_NN.jpg`：
   - 本地路径：`cp <src> public/scene-library/<id>.jpg`
   - URL：`curl -L -o public/scene-library/<id>.jpg <url>`
   - 用户在对话里贴的：用 Read 拿到路径后 cp
3. **不做额外压缩或裁剪**（除非用户要求）。如果文件 > 5MB 或非 jpg，提醒用户"建议先压成 1500px 长边的 jpg，要我帮你跑 sharp 吗？"

## 4. 写入 scene-library.json

1. Read `scripts/scene-library.json` 当前内容
2. 用 Edit 工具在数组**末尾**追加新条目（在最后一个 `}` 后插入 `,\n  { ... }`）
3. 不要重写整个文件，避免破坏其他条目的格式

写入前**完整展示**最终 JSON 块给用户，让 ta 一眼看清楚要追加什么。

## 5. 匹配自检（必跑）

新场景加进去后，验证它**真的能被匹配到**。用户的常见 SceneTags 组合有以下几种典型："canonical SceneTags"：

```ts
const probes = [
  { color_temperature: 'warm',    light_direction: 'front',   light_intensity: 'soft', visible_body: 'face_only' },
  { color_temperature: 'warm',    light_direction: 'left',    light_intensity: 'soft', visible_body: 'upper_chest' },
  { color_temperature: 'neutral', light_direction: 'ambient', light_intensity: 'soft', visible_body: 'waist_up' },
  { color_temperature: 'cool',    light_direction: 'top',     light_intensity: 'harsh', visible_body: 'full_body' },
];
```

按 `match-scene.ts` 里的逻辑**手动模拟**对每个 probe 检查：
- 新场景能否在 Level 0 / 1 / 2 / 3 出现在候选里
- 如果 Level 0-3 全都进不了（只能在 Level 4 兜底），说明这个场景的 tag 组合在库里**孤儿化**了，标红警告用户

输出：

```
匹配自检：
  probe 1 (warm/front/soft/face_only) → 新场景在 Level 0 候选 ✓
  probe 2 (warm/left/soft/upper_chest) → 新场景在 Level 1 候选 ✓
  probe 3 (neutral/ambient/soft/waist_up) → 新场景未进 Level 0-3 ⚠
  probe 4 (cool/top/harsh/full_body) → 新场景在 Level 2 候选 ✓
```

如果出现 ⚠，提示用户："这张场景的 tag 组合可能不会被自然匹配到，是不是 tag 打错了？或者 visible_body=X 的用户根本拍不到这种场景？"

## 6. 可选：跑 fusion 回归

问用户："要不要现在跑 `npm run test:fusion` 实测这张新场景的融合效果？这会**调 Gemini API 烧钱**，每张测试输入大约 $0.02-0.05。"

- 用户同意 → `cd simple_saas && npm run test:fusion`，跑完读 `scripts/test-outputs/log.txt` 和 `match.json` 摘要给用户
- 用户拒绝 → 提示 "OK，回归留给你自己手动跑"，跳到 step 7

## 7. 收尾

输出一份"完成总结"：

```
✅ 已添加场景 <id>
  - 图片：public/scene-library/<id>.jpg
  - 元数据：scripts/scene-library.json（追加在末尾）
  - 匹配自检：通过 / 部分通过（见上面）
  - Fusion 实测：已跑 / 未跑

建议下一步：
  - git diff scripts/scene-library.json
  - git status public/scene-library/
  - 满意 → git add + commit
  - 不满意 → git checkout 回滚 JSON，rm public/scene-library/<id>.jpg
```

## 强约束（不要破例）

- **不调 Gemini 打标场景**——你（多模态主 Claude）直接看图。除非用户明确说"用 Gemini 打"
- **不重写 scene-library.json**——只能 append，避免影响其他条目
- **不动 public/scene-library/ 里的现有文件**
- **不自动跑 npm run test:fusion**——必须用户同意（烧钱）
- **不自动 git commit**——所有改动留给用户审核
- **批量场景一张张过 step 2-4，每张都让用户确认**，不要为了"提效"打包询问导致漏标错标
- 如果用户给的图明显不是场景图（比如人像、UI 截图），明确拒绝："这张看起来不是场景照片，确认一下？"
