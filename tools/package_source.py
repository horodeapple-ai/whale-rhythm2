from pathlib import Path
import zipfile, hashlib, json
ROOT=Path(__file__).resolve().parent.parent
output=ROOT/'output/DeepSeek-接单喜剧-HTML与源码.zip'
items=[]
for directory in ['src','vendor','assets','tools']:
    items += [p for p in (ROOT/directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.name not in ['verify_preview.cjs','render_preview.cjs','patch_opening.py']]
items += [ROOT/'README-使用说明.txt', ROOT/'package.json', ROOT/'CREDITS.md', ROOT/'source/motion-plan-reference.md', ROOT/'output/DeepSeek-Whale-Cutpaper-Full-Film.html']
items += [p for p in (ROOT/'qa').rglob('*.json') if p.is_file()]

with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in sorted(items):
        name=p.name if p.parent.name=='output' else str(p.relative_to(ROOT))
        z.write(p,name)
with zipfile.ZipFile(output) as z:
    assert z.testzip() is None
print(json.dumps({'path':str(output),'bytes':output.stat().st_size,'files':len(items),'sha256':hashlib.sha256(output.read_bytes()).hexdigest()}))
