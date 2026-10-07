# 第三方素材与署名

本仓库是围绕**他人作品**做的同人 / 衍生创作（**仓库已公开**）。下面这些东西不是本工程原创，使用或再分发前请先读完本页。

## 1. 歌曲（音频不入库）

- 曲：《Let Me Go（共创版）》— 罐装毕加索
- 原作：@星落落_oi（原投稿 BV1R5YL69EC5）
- 词：DeepSeek；曲：Suno / 豆包（沿原投稿署名）
- 原投稿：[BV1XbY66nEWr](https://www.bilibili.com/video/BV1XbY66nEWr/)
- 官方歌词时间轴来源：网易云音乐官方 LRC（歌曲 id `3436937347`，《Let Me Go(共创版)》，124440 ms）
- **音频文件 `assets/song.m4a` 没有放进仓库**（版权属原作者；`.gitignore` 里已排除）。
  本地要跑，请自行把音频另存到 `assets/song.m4a`（48 kHz 立体声 AAC，约 140.03 秒）。

## 2. 参考实现（仓库里的 `vendor/rich-*.js`）

- 来源：[beidou070/let-me-go-code-mv](https://github.com/beidou070/let-me-go-code-mv)（对应成片 [BV1C7h16jEHJ](https://www.bilibili.com/video/BV1C7h16jEHJ/)，UP：polaris0）
- 本仓库的 `vendor/rich-lib.js`、`vendor/rich-cast.js` 是在其 `src/lib.js`、`src/cast.js` 基础上改写/裁剪而来；
  `vendor/rich-song.js` 是按其数据结构重新生成的节拍网格数据（**注意：该文件的拍点是恒速网格，与真实音频有漂移，
  本工程已改用实测节拍表 `src/beat-data.mjs`，歌词也改用了官方 LRC**）。
- 该工程 README 明确写了：**项目自有代码暂未授予通用开源许可证**；角色衍生部分按
  **CC BY-NC-SA 4.0**（署名、非商业、相同方式共享）。
- 角色原型「溟月」：@上善无形；女仆鲸鱼娘设计：@ZipZipPipe。
- ⚠️ 也就是说：**本仓库里的 `vendor/` 属于第三方未授权代码**。若要公开此仓库，请先确认你有权分发，
  或把 `vendor/` 换成你自己的实现（本工程对它的依赖集中在纸片绘制词汇上：`piece/blob/rr/at/M/tr` 等）。

## 3. 字体（仓库内 `assets/*.ttf`）

| 字体 | 用途 | 许可 |
| --- | --- | --- |
| ZCOOL KuaiLe（站酷快乐体） | 画面中文 | SIL Open Font License 1.1 |
| Fredoka | 字幕英文 | SIL Open Font License 1.1 |

两者都是 OFL 授权，可随工程分发；正式分发时建议把 OFL 许可全文一并附上。

## 4. 运行时依赖

- [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas)（MIT）— 只用于**离线**逐帧渲染与冒烟检查；
  浏览器播放不需要它（`tools/build_html.py` 产出的单文件 HTML 内嵌字体与音频，离线可播）。

## 5. 本工程原创部分

`src/`（除 `vendor/` 外的绘制词汇）与 `tools/` 为本工程代码。画面、分镜、角色纸片实现
（`src/paper-whale.mjs` 等）为本工程绘制，未拷贝上述参考工程的角色资产。
