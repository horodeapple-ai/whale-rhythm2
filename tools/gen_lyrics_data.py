# -*- coding: utf-8 -*-
"""由官方 LRC + 参考 song.js 的中文译文，生成 src/lyrics-data.mjs（本工程 140.032s 时间轴）。
映射（均已实测，见 tools/verify_map.py / resolve_offset.py / find_true_onset.py）：
  正歌部分  our = mv + 15.065
    依据：① 静音缺口指纹（our 15.125–15.175 的 0.050s 缺口 ↔ mv 0.060–0.110 的 0.050s 缺口）
          ② 全片 mel 相似度精细扫描峰值 +15.068（0.982）
          ③ 内容起音：our 15.470 ↔ mv 0.402 → +15.068
  前奏段    our = mv − 87.1707
    依据：本工程 0–14.68s 与 mv 87.1707–101.8507 是同一段录音（相似度 0.99，偏移稳定）
          —— 这一段正是官方 LRC 里 94.155/95.762/97.633/99.467 四句拟声，
          所以本工程前 14.68s 也有唱词，必须一起做字幕。
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D_MAIN, D_INTRO = 15.065, 87.1707

lrc = open(os.path.join(ROOT, "out", "ref-repo", "netease_lrc.txt"), encoding="utf-8").read()
tly = open(os.path.join(ROOT, "out", "ref-repo", "netease_tlyric.txt"), encoding="utf-8").read()
ref = open(os.path.join(ROOT, "out", "ref-repo", "v2__src__song.js"), encoding="utf-8").read()
js = json.loads(ref[ref.index("{"):ref.rindex("}") + 1])
zh_fallback = {round(l["t"], 3): l["zh"].strip() for l in js["lyrics"]}

def parse(txt):
    """LRC 文本 -> [[秒, 文本], ...]（文本可为空串，代表分隔空行）；跳过 [by:] 之类元信息行"""
    out = []
    for line in txt.splitlines():
        m = re.match(r"\[(\d+):(\d+(?:\.\d+)?)\](.*)", line.strip())
        if not m:
            continue
        out.append([int(m.group(1)) * 60 + float(m.group(2)), m.group(3).strip()])
    return out

entries = parse(lrc)
# 中文改用网易云官方翻译（用户 2026-10-08 指定）；缺行时回退到参考 song.js 的译文
zh_by_t = {}
for t, txt in parse(tly):
    if txt:
        zh_by_t[round(t, 3)] = txt
print("网易云翻译 %d 句；参考 song.js 译文 %d 句" % (len(zh_by_t), len(zh_fallback)))

LAST_END = 122.6   # 官方 LRC 最后一句没有结束时间；参考 song.js 取 122.6（= mv 时间轴）
out = []
for i, (t, txt) in enumerate(entries):
    if not txt:
        continue
    # 结束时间：下一个条目（含空行）的时间；最后一句用 LAST_END
    end = entries[i + 1][0] if i + 1 < len(entries) else LAST_END
    en = txt
    zh = zh_by_t.get(round(t, 3), "")
    if not zh:
        zh = zh_fallback.get(round(t, 3), "")
        print("  ! 网易云翻译缺 %.3f，回退参考译文：%s" % (t, zh))
    out.append({"t": t, "end": end, "en": en, "zh": zh})

# 分类映射
# 前奏段 = 本工程 0–14.68s（= mv 87.1707–101.8507）。只收"在这段里完整唱到"的句子：
# 官方 LRC 的 94.155 / 95.762 / 97.633 / 99.467 四句拟声。
# 101.482 的 "So let me go" 只被复制到 0.37s 就被切断了（那是正歌第一句），丢弃。
INTRO_MAX_T = 101.2
main_l, intro_l = [], []
for r in out:
    if 86.761 <= r["t"] <= INTRO_MAX_T:
        intro_l.append({"t": round(r["t"] - D_INTRO, 3), "end": round(r["end"] - D_INTRO, 3),
                        "en": r["en"], "zh": r["zh"]})
    main_l.append({"t": round(r["t"] + D_MAIN, 3), "end": round(r["end"] + D_MAIN, 3),
                   "en": r["en"], "zh": r["zh"]})

lines = sorted(intro_l + main_l, key=lambda r: r["t"])
for a, b in zip(lines, lines[1:]):
    assert a["end"] <= b["t"] + 1e-6, "时间重叠：%s -> %s" % (a, b)
print("总句数 %d（前奏段 %d + 正歌 %d）" % (len(lines), len(intro_l), len(main_l)))
print("覆盖：%.3f – %.3f s" % (lines[0]["t"], lines[-1]["end"]))

hdr = '''/* ============================================================================
 * src/lyrics-data.mjs —— 《Let Me Go（共创版）》双语歌词时间轴（本工程 140.032s 时间轴）
 * ----------------------------------------------------------------------------
 * 数据来源（不是"按节拍网格编的"，是官方歌词）：
 *   时间 = 网易云音乐官方 LRC（歌曲 id 3436937347，罐装毕加索《Let Me Go(共创版)》，
 *          时长 124440ms）。该 LRC 与 BV1C7h16jEHJ（大肥鱼摸鱼歌动画 MV）源码仓库
 *          beidou070/let-me-go-code-mv 的 v2/src/song.js 歌词逐句逐字完全一致（0 差异）。
 *   中文 = **网易云官方翻译（tlyric）**（用户 2026-10-08 指定；out/ref-repo/netease_tlyric.txt）。
 *          参考 MV 源码里另有一版自定义译文（"调用我来发"等），如要换回见 gen_lyrics_data.py。
 *
 * 为什么需要映射：本工程音频 140.032s 与官方 LRC 的 124.44s 版本是同一次录音，
 *   但本工程音频前面多了一段。实测（三个独立证据一致，误差 <3ms）：
 *     正歌部分   our = mv + 15.065
 *       ① 静音缺口指纹：our 15.125–15.175 的 0.050s 数字静音缺口 ↔ mv 0.060–0.110 的
 *          0.050s 缺口（位置与长度同时吻合）
 *       ② 全片对数谱相似度精细扫描峰值 +15.068（平均相似度 0.982；±0.9s 处只有 0.77）
 *       ③ 内容起音：our 15.470 ↔ mv 0.402（都是"静音缺口之后音乐进来"的那一下）
 *     前奏段     our = mv − 87.1707
 *       本工程 0–14.68s 与 mv 87.1707–101.8507 是同一段录音（相似度 0.99、偏移稳定），
 *       而官方 LRC 在这段里有 4 句拟声，所以本工程开头这段也有唱词，字幕要一起做。
 *       之后 own 14.68–15.175 是 0.395s 静音（无字幕）。
 *
 * 时间轴小注：官方 LRC 把每句放在"乐句起拍（含起头那句的镲片/气口）"，第一句 0.138s
 *   对应的是开头那记镲（实测人声+乐队真正进来是 mv 0.402 = our 15.470，早 0.26s）。
 *   这是歌词视频的常规做法，也是 BV1C7h16jEHJ 里显示的位置，故原样保留。
 *   若以后想整体挪一点，只改下面这个 LRC_NUDGE 常量即可（正数=字幕更晚出现）。
 * ========================================================================== */
export const LRC_NUDGE = 0;

export const LYRICS = [
'''

body = []
for r in lines:
    body.append(' {t: %s, end: %s, en: %s, zh: %s},' % (
        r["t"], r["end"], json.dumps(r["en"], ensure_ascii=False), json.dumps(r["zh"], ensure_ascii=False)))
txt = hdr + "\n".join(body) + "\n];\n"
p = os.path.join(ROOT, "src", "lyrics-data.mjs")
with open(p, "w", encoding="utf-8") as f:
    f.write(txt)
print("写出 %s（%d 字节）" % (p, len(txt.encode("utf-8"))))
for r in lines:
    print("   %8.3f – %8.3f  %-44s | %s" % (r["t"], r["end"], r["en"][:44], r["zh"][:22]))
