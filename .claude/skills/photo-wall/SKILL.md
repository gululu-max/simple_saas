---
name: photo-wall
description: 首页照片墙（PhotoWall）增删改的完整 SOP。覆盖：图片 sharp 转换/压缩到 webp → 落盘到 public/hero/women/ → 更新 components/photo-wall.tsx 的 ROW1/ROW2 数组 → 启动 next dev 验证 404。支持三种操作：ADD（追加新槽位）、REPLACE（覆盖指定槽位）、DELETE+REINDEX（删一张后连号重排）。当用户说"加张照片到首页照片墙"、"换 w07"、"删了 w03 重排一下"、"导入 N 张新女性照片"等时触发。
---

# /photo-wall — 首页照片墙增删改

你（主 Claude）按下面的步骤处理用户给的图。**每一步完成都向用户确认进度**，**任何写文件操作前先告诉用户要写什么**。

## 0. 项目坐标（先记住）

- 组件：[components/photo-wall.tsx](../../../components/photo-wall.tsx)
  - `ROW1`：上排（向左滚动），当前 7 张
  - `ROW2`：下排（向右滚动），当前 8 张
- 图片目录：`public/hero/women/`（命名规则：`wNN.webp`，NN 是两位数从 01 开始）
- 卡片渲染尺寸：mobile `130×180`、md+ `170×220`（CSS `object-cover`）
- 目标输出规格：**`340×440` webp（2x retina，居中 cover 裁剪），质量 80**
- 懒加载：组件里 `loading={i < images.length ? "eager" : "lazy"}`——前 N 张 eager，复制段 lazy
- dev server：`npm run dev`（默认 `http://localhost:3000`，next dev）
- sharp 已在 dependencies：`"sharp": "^0.34.5"`

## 1. 收集输入

向用户确认以下信息（如果消息里没给齐就一次性问完，不要来回挤牙膏）：

1. **操作类型**：`add` / `replace` / `delete`
2. **源图路径**：本地绝对路径，可以多个
3. **目标槽位**（仅 `replace` 必填）：例如 `w07`
4. **删除槽位**（仅 `delete` 必填）：例如 `w03`，可多个
5. **放在 ROW1 还是 ROW2**（仅 `add` 时，如果不指明默认放 ROW2 末尾，平衡两排长度）

如果用户给的是横图（宽 > 高），警告："照片墙是竖卡片（170×220），横图居中 crop 后两侧会被切。继续吗？"

## 2. 图片处理（sharp 转 webp + 压缩）

每张源图都跑一次：

```bash
node -e "require('sharp')('<src>').resize(340, 440, { fit: 'cover', position: 'center' }).webp({ quality: 80 }).toFile('<dst>')"
```

约束：
- `<src>` 用户给的绝对路径；`<dst>` 是 `public/hero/women/wNN.webp`（NN 见 step 3）
- 如果源文件是 `.heic`：sharp 0.34 默认不支持 HEIC，提示用户先转 jpg/png 再来
- 处理完检查文件大小：>150KB 的提示一下"`<file>` 处理后还有 XX KB，质量 80 可能裁得太大，要降到 75 重跑吗？"

## 3. 决定文件名

### 3a. ADD 模式

1. Glob `public/hero/women/w*.webp` 拿到现有最大 NN
2. 新文件用 NN+1、NN+2…（两位数补零）
3. 处理多张时按用户给的顺序连号

### 3b. REPLACE 模式

直接覆盖用户指定的槽位（如 `w07.webp`）。**文件名不变，数组也不动**——只是 sharp 重新生成同名 webp。

⚠️ 写之前提醒用户："w07.webp 会被覆盖，原图无法恢复（除非你有 git/备份）。继续？"

### 3c. DELETE+REINDEX 模式

1. 用 Bash `rm` 删用户指定的槽位（如 `w03.webp`）
2. 把比删除位大的全部往前补一位：`w04→w03`、`w05→w04`…一直到末尾
3. 用 Bash `mv` 批量重命名

⚠️ 这是破坏性操作，**写之前列出完整重命名清单给用户确认**：
```
要删除：w03.webp
要重命名：w04→w03, w05→w04, w06→w05, ..., w15→w14
最终 w01-w14 共 14 张
```

## 4. 更新 components/photo-wall.tsx

### ADD / DELETE+REINDEX：必须改数组

Read 当前 [components/photo-wall.tsx](../../../components/photo-wall.tsx)，用 Edit 工具改 `ROW1` 或 `ROW2` 数组。

- **ADD**：在指定 ROW 数组末尾追加 `"/hero/women/wNN.webp",`
- **DELETE+REINDEX**：因为编号变了，**两个 ROW 都要重新生成**——按"ROW1 前一半、ROW2 后一半"的当前分配规则重排（或按用户指定）

写之前告诉用户最终的 ROW1/ROW2 长什么样，等确认再 Edit。

### REPLACE：不改数组

只覆盖文件，`photo-wall.tsx` 不动。明确告诉用户："数组未改，文件已覆盖"。

### 平衡两排长度

ADD 时如果用户没指明 ROW，遵循"哪排短放哪排"原则（当前 ROW1=7、ROW2=8，新增默认 ROW1）。

## 5. 启动 dev server 验证 404

```bash
cd simple_saas && npm run dev
```

用 `run_in_background: true`，等 ~5 秒看 stdout 是否出现 `Ready` / `started server`。

然后对**每个新增/替换的文件**跑：

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/hero/women/wNN.webp
```

期望全 `200`。任何 `404` 立即停下报错。

验证完用 `KillShell`（或对应工具）关掉 dev server，**不要**让它继续后台占端口。

## 6. 收尾

输出一份"完成总结"：

```
✅ photo-wall 更新完成
  - 操作：add / replace / delete+reindex
  - 新增/修改文件：public/hero/women/wXX.webp (X 张)
  - components/photo-wall.tsx：ROW1 = N 张，ROW2 = M 张（或：未改）
  - 404 自检：全部 200 ✓
  - dev server：已关闭

建议下一步：
  - git status public/hero/women/ components/photo-wall.tsx
  - 满意 → git add + commit
  - 不满意 → git checkout 回滚 tsx，git clean / git checkout public/hero/women/
```

## 强约束（不要破例）

- **不动 ROW1/ROW2 以外的代码**——动画速度、卡片尺寸、渐变 mask 都不是这个 skill 的职责
- **不重命名 `wNN.webp` 这套命名规则**——除非用户明确说要改命名
- **不在 ADD 时主动给「人脸打分」或「重排顺序」**——按用户给的顺序连号就行
- **REPLACE 前必须告知"原图会丢"**，让用户确认
- **DELETE+REINDEX 前必须列出完整重命名清单**，让用户确认
- **不自动 git commit / git add**——所有改动留给用户审核
- **dev server 验证完必须关掉**——别留后台进程
- **批量处理时一张张走 step 2-3，每张都让用户大致看一眼大小是否合理**，不要静默连发多张
- 如果用户给的图明显不是人像（截图、宠物、风景），明确拒绝："这张看起来不是女性人像，确认一下？照片墙的语义是 hero/women。"
