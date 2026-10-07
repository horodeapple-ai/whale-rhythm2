from pathlib import Path
import base64, json, re, posixpath
ROOT=Path(__file__).resolve().parent.parent
def b64(p): return base64.b64encode((ROOT/p).read_bytes()).decode()
sources={}
imports={}
def add(name):
    if name in sources: return
    s=(ROOT/name).read_text(); sources[name]=s
    links=[]
    for m in re.finditer(r'''(?:from\s*|import\s*)['"]([^'"]+)['"]''',s):
        dep=m.group(1)
        if not dep.startswith('.'): raise ValueError('External import '+dep)
        target=posixpath.normpath(posixpath.join(posixpath.dirname(name),dep))
        links.append({'at':m.start(1),'end':m.end(1),'target':target});add(target)
    imports[name]=sorted(links,key=lambda x:x['at'],reverse=True)
add('src/player.mjs')
classic='\n'.join((ROOT/p).read_text() for p in ['vendor/rich-song.js','vendor/rich-lib.js','vendor/rich-cast.js'])
assert '</script' not in classic.lower()
script='const sources='+json.dumps(sources,ensure_ascii=False).replace('<','\\u003c')+',imports='+json.dumps(imports)+''',urls=new Map();
function url(id){if(urls.has(id))return urls.get(id);let s=sources[id];for(const i of imports[id])s=s.slice(0,i.at)+url(i.target)+s.slice(i.end);const u=URL.createObjectURL(new Blob([s],{type:'text/javascript'}));urls.set(id,u);return u}
try{await import(url('src/player.mjs'))}catch(e){document.getElementById('status').textContent='初始化失败：'+e.message;console.error(e)}'''
html='''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; media-src data:; font-src data:; img-src data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'"><title>大肥鱼，先干活再吃饭！· 原版蓝金精修</title><style>
@font-face{font-family:KuaiLe;src:url(data:font/ttf;base64,FONT_A)}
@font-face{font-family:Fredoka;src:url(data:font/ttf;base64,FONT_B)}
*{box-sizing:border-box}body{margin:0;background:#081d39;color:#fff0cd;font-family:KuaiLe,system-ui,sans-serif}main{max-width:1600px;margin:auto;padding:18px}h1{font-size:25px;font-weight:400;margin:0 0 12px}canvas{display:block;width:100%;height:auto;background:#0a2448;border:1px solid #dfad49;border-radius:6px}.controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px}button{font:inherit;font-size:19px;background:#f4c267;color:#123c63;border:0;border-radius:8px;padding:10px 20px;cursor:pointer}button:disabled{opacity:.45;cursor:default}input{flex:1;min-width:180px;accent-color:#efba50}small{display:block;color:#a7cbd6;margin-top:12px;line-height:1.6}#status{margin-top:10px;color:#d9f3ed}audio{display:none}label.subs{display:flex;align-items:center;gap:6px;font-size:18px;color:#ffe7b8;flex:0 0 auto}label.subs input{flex:0 0 auto;min-width:0;width:18px;height:18px;margin:0;accent-color:#efba50}</style></head><body><main>
<h1>大肥鱼，先干活再吃饭！</h1><canvas id="stage" width="1920" height="1080"></canvas>
<div class="controls"><button id="toggle" disabled>播放</button><button id="replay" disabled>从头播放</button><label class="subs"><input type="checkbox" id="subs" checked>字幕</label><input id="seek" type="range" min="0" max="140.032" step="0.0333333333333" value="0" aria-label="播放进度"><span id="time">0.00 / 140.03</span></div>
<div id="status" role="status">载入中…</div><small>原版蓝金精修 · 140.032 秒 · 1920×1080 · 原音乐保留。页面内嵌全部资源，可离线打开。<b>播放键与暂停键已合并为一个切换键，按空格也可播放 / 暂停。</b>播放需支持 AAC 音频与 Canvas 的现代浏览器。</small>
<audio id="audio" preload="auto" src="data:audio/mp4;base64,AUDIO"></audio></main><script>CLASSIC</script><script type="module">MODULE</script></body></html>'''
html=html.replace('FONT_A',b64(Path('assets/ZCOOLKuaiLe-Regular.ttf'))).replace('FONT_B',b64(Path('assets/Fredoka-Variable.ttf'))).replace('AUDIO',b64(Path('assets/song.m4a'))).replace('CLASSIC',classic).replace('MODULE',script)
dest=ROOT/'output/DeepSeek-Whale-Cutpaper-Full-Film.html';dest.write_text(html)
(ROOT/'qa/bundle-manifest.json').write_text(json.dumps({'modules':list(sources),'moduleCount':len(sources),'externalRequests':0,'audioEmbeddedBytes':(ROOT/'assets/song.m4a').stat().st_size,'htmlBytes':dest.stat().st_size},indent=2))
print(dest, dest.stat().st_size)
