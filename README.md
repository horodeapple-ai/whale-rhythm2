# 大肥鱼，先干活再吃饭！· 画面律动版2（whale-rhythm2）

140.032 秒 / 30 fps / 1920×1080 的纯代码纸艺 MV：76 个镜头、A–D 四段，画面全部由 Canvas 2D 绘制，
没有一张位图素材；配《Let Me Go（共创版）》（罐装毕加索）原曲，中英双语歌词字幕。

> 这是「画面律动改造版」的工程：在原版基础上只让**场景元素与纸片 UI** 跟拍（均衡条 / 灯笼 / 辉光 /
> 地线 / 粒子 / 纸屑 / 卡片弹跳行波），**角色本身完全不形变、不转动部件**，也不做整屏闪光/抖屏。

## 怎么跑

需要 **Node.js 22+**、**Python 3**、以及一份《Let Me Go（共创版）》音频（见下）。

```bash
# 1) 依赖
npm install                       # 只有一个运行时依赖：@napi-rs/canvas（离线逐帧渲染用）

# 2) 放入音频（版权原因不入库）
#    把歌曲音频另存为 assets/song.m4a   （48000 Hz 立体声 AAC，约 140.03 秒）

# 3) 打成单文件 HTML（内嵌字体/音频，双击即可离线播放）
python tools/build_html.py        # 输出 output/DeepSeek-Whale-Cutpaper-Full-Film.html

# 4) 逐帧渲染 / 抽帧核对（可选）
node tools/render_film.cjs
node tools/render_sweep.mjs --from=0 --to=8 --step=1
```

播放页有「播放 / 从头播放 / 字幕」三个控件，空格键也能播放暂停。

## 工程结构

| 目录 | 作用 |
| --- | --- |
| `src/scene.mjs` | 全片入口：按时间线把镜头分派给 A–D 四个 block，末尾叠动效与字幕 |
| `src/motion-system.mjs` | 时间线 / 镜头表 / 相机（只允许极轻微推近与暗角） |
| `src/beat-data.mjs` | **实测节拍表**（301 个拍点；这首歌 126–131 BPM 变速，恒速网格会漂到反拍） |
| `src/blocks/a-…d-…mjs` | 四段画面的分镜实现（76 镜） |
| `src/paper-whale.mjs` | 角色绘制（纸片木偶；这一层在本次改造里**逐字节未动**） |
| `src/subtitles.mjs` + `src/lyrics-data.mjs` | 双语歌词字幕与官方歌词时间轴（映射依据写在数据文件头部） |
| `src/rhythm.mjs` / `world-fx.mjs` / `rhythm-fx.mjs` | 只作用在场景元素上的律动层 |
| `tools/` | 构建（`build_html.py`）、逐帧渲染、抽帧、扫错、节拍/切点验收、字幕与台词核对 |
| `out/HANDOFF-2026-10-08.md` | **交接文档**：环境、红线、四步流程、踩坑、字幕与台词的来龙去脉 |
| `baseline/` | 原版基线（抽帧做 A/B 对照用） |
| `vendor/` | 绘制词汇库（纸片/描边/投影等；来源见 CREDITS.md） |

## 制作者的红线（改动前请先读）

1. 不整屏闪光、不抖屏/不滚转；相机只允许极轻微推近与暗角。
2. **角色完全不动**——不形变、不转部件；`src/paper-whale.mjs` 与原版逐字节相同（构建里有断言守着）。
3. 律动只做在场景元素与纸片 UI 上。
4. 一切必须是时间 `t` 的纯函数：不许 `Math.random` / `Date.now`。

改完的标准流程见 `out/HANDOFF-2026-10-08.md` 第 4 节（语法检查 → 逐帧扫错 → 构建 → 部署）。

## 署名与许可

见 [CREDITS.md](CREDITS.md)。**注意**：本项目是围绕他人作品的同人/衍生创作，仓库里含第三方代码与角色相关素材，
公开前请先读那一页。
