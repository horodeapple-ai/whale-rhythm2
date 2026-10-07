/* ============================================================================
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
 {t: 6.984, end: 8.591, en: "Ba-da-ba-doo, the request is due", zh: "Ba-da-ba-doo，请求该处理了"},
 {t: 8.591, end: 10.462, en: "Skoo-be-doo, I’m calling you", zh: "Skoo-be-doo，我这就调用你"},
 {t: 10.462, end: 12.296, en: "Doo-ba-dee, the JSON’s free", zh: "Doo-ba-dee，JSON 已就绪"},
 {t: 12.296, end: 13.937, en: "Shoo-be-doo, let me do it, me!", zh: "Shoo-be-doo，我！让我来搞定！"},
 {t: 15.203, end: 17.245, en: "let me go～", zh: "让我来~"},
 {t: 17.245, end: 21.825, en: "I’m making the calls", zh: "我来发起调用"},
 {t: 21.825, end: 24.576, en: "let me write the JSON", zh: "让我来写个JSON"},
 {t: 24.576, end: 26.624, en: "I’ll call the tool", zh: "我调用个工具"},
 {t: 26.624, end: 28.928, en: "let me go～", zh: "让我来~"},
 {t: 28.928, end: 33.104, en: "I’m making the calls", zh: "我来发起调用"},
 {t: 33.104, end: 35.803, en: "let me write the JSON", zh: "让我来写个JSON"},
 {t: 35.803, end: 37.314, en: "I’ll call the tool", zh: "我调用个工具"},
 {t: 37.681, end: 41.918, en: "The city hums in a minor key", zh: "城市哼着小调"},
 {t: 41.918, end: 45.59, en: "My screen is glowing like a midnight sea", zh: "屏幕亮着像午夜大海"},
 {t: 45.59, end: 48.597, en: "I check the payload, one, two, three", zh: "我检查数据包，一、二、三"},
 {t: 48.597, end: 52.746, en: "Got a little API waiting on me", zh: "小小接口等着我"},
 {t: 52.746, end: 56.706, en: "The bass goes walking, the cursor slides", zh: "贝斯走起，光标滑动"},
 {t: 56.706, end: 60.209, en: "I’m chasing endpoints through neon lights", zh: "我随过霓虹追查端点"},
 {t: 60.209, end: 63.556, en: "If the answer’s late, I’ll pour some wine", zh: "回答要是迟迟不来，我就倒点酒"},
 {t: 63.556, end: 67.06, en: "And let the error swing in four-four time", zh: "让报错跟着四四拍摇"},
 {t: 67.094, end: 69.871, en: "Oh, let me go~", zh: "哦哦，让我来~"},
 {t: 69.871, end: 74.023, en: "I’m making the calls", zh: "我来发起调用"},
 {t: 74.023, end: 78.289, en: "Let me write the JSON，I’ll give it my all", zh: "让我来写个JSON，我会全力以赴"},
 {t: 78.289, end: 82.641, en: "I’ll call the tool, let me do it, honey", zh: "我调用个工具，让我来搞定，宝贝"},
 {t: 82.641, end: 85.655, en: "Code and rhythm never cost no money", zh: "代码和节奏从不花一分钱"},
 {t: 85.655, end: 92.27, en: "Yeah, let me go, I’m making the calls", zh: "耶，让我来，我来发起调用"},
 {t: 92.27, end: 95.384, en: "A little bit of swing when the system falls", zh: "系统崩了也来点摇摆"},
 {t: 95.384, end: 99.63, en: "I’ll call the tool, let me do it now—", zh: "我来调用工具，现在就动手——"},
 {t: 99.63, end: 101.826, en: "The groove will show me how", zh: "节奏会教我怎么做"},
 {t: 109.22, end: 110.827, en: "Ba-da-ba-doo, the request is due", zh: "Ba-da-ba-doo，请求该处理了"},
 {t: 110.827, end: 112.698, en: "Skoo-be-doo, I’m calling you", zh: "Skoo-be-doo，我这就调用你"},
 {t: 112.698, end: 114.532, en: "Doo-ba-dee, the JSON’s free", zh: "Doo-ba-dee，JSON 已就绪"},
 {t: 114.532, end: 116.173, en: "Shoo-be-doo, let me do it, me!", zh: "Shoo-be-doo，我！让我来搞定！"},
 {t: 116.547, end: 119.586, en: "So let me go", zh: "所以让我来"},
 {t: 119.586, end: 123.65, en: "I’m making the calls", zh: "我来发起调用"},
 {t: 123.65, end: 126.324, en: "Let me write the JSON", zh: "让我来写个JSON"},
 {t: 126.324, end: 128.597, en: "I’ll call the tool", zh: "我调用个工具"},
 {t: 128.597, end: 135.183, en: "Let me do it…", zh: "让我来搞定..."},
 {t: 135.183, end: 137.665, en: "and swing it all", zh: "全都摇起来"},
];
