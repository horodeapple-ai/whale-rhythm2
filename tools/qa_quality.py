"""Compare encoded viewing/master frames through native FFmpeg extraction only.

No browser access, source rendering, encoding, or audible/realtime-playback claims.
Run --extract master while the viewing encode is pending, then --extract view
and --compare after both encodes are complete. No media file is changed.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFont

R = Path(__file__).resolve().parent.parent
QA = R / 'qa'
FILES = {'view': 'DeepSeek-接单喜剧-1080p完整版.mp4',
         'master': 'DeepSeek-接单喜剧-完整版母版.mp4'}
# Source-time targets converted against the frozen final scene clock, rounded to
# nearest existing video frame. These are timeline frame indices, not seek guesses.
SAMPLES = [
    (0, 'Opening first frame'), (60, 'Opening detail'), (737, 'Pelican motion'),
    (2082, 'Overload contact'), (2428, 'Work-order cards'), (2500, 'Agent arrival'),
    (2575, 'Three agent roles'), (2785, 'Drawing badge'), (3160, 'Return to main'),
    (3455, 'Collect results'), (3843, 'Unified delivery'),
    (4199, 'Final title and badges'), (4200, 'Last video frame')]
# Native-resolution crops, identical in both videos. All encompass legible labels
# or meaningful full title/cue panels in the intended frame, with generous margin.
REGIONS = [
    (2428, 'work-order-cards', (900, 480, 1150, 730)),
    (2575, 'three-agent-roles', (425, 705, 1710, 850)),
    (2575, 'bottom-role-captions', (400, 930, 1710, 1035)),
    (2785, 'drawing-agent-badge', (700, 250, 860, 380)),
    (3160, 'return-cue', (500, 75, 830, 165)),
    (3160, 'code-agent-badge', (940, 295, 1120, 425)),
    (3160, 'review-agent-badge', (1100, 645, 1270, 780)),
    (3455, 'main-merge-cue', (600, 650, 1100, 980)),
    (3843, 'unified-delivery-cue', (800, 80, 1130, 175)),
    (4199, 'final-agent-badges', (1160, 805, 1720, 930)),
    (4199, 'final-title', (1060, 935, 1560, 1060)),
]


def execute(args):
    p = subprocess.run(args, text=True, capture_output=True)
    if p.returncode:
        raise RuntimeError(p.stderr.strip() or f'Command failed: {args[0]}')
    return p


def path(kind, frame):
    return QA / f'video-quality-{kind}-{frame:04d}.png'


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def extract(kind):
    select = '+'.join(f'eq(n\\,{frame})' for frame, _ in SAMPLES)
    with tempfile.TemporaryDirectory(prefix='film-video-qa-') as tmp:
        output = str(Path(tmp) / '%03d.png')
        execute(['ffmpeg', '-hide_banner', '-v', 'error', '-xerror', '-threads', '2',
                 '-i', str(R / 'output' / FILES[kind]), '-an',
                 '-vf', f'select={select}', '-fps_mode', 'vfr', '-threads', '2', output])
        extracted = sorted(Path(tmp).glob('*.png'))
        if len(extracted) != len(SAMPLES):
            raise RuntimeError(f'{kind}: extracted {len(extracted)} of {len(SAMPLES)} frames')
        for src, (frame, _) in zip(extracted, SAMPLES):
            shutil.copyfile(src, path(kind, frame))
    manifest = [{'frameIndex': frame, 'timelineSeconds': frame / 30,
                 'purpose': name, 'file': path(kind, frame).name}
                for frame, name in SAMPLES]
    (QA / f'video-quality-{kind}-samples.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'extracted': kind, 'nativeFrames': len(manifest), 'size': [1920, 1080]}))


def image_metrics(a, b):
    x = np.asarray(a.convert('RGB'), dtype=np.float64)
    y = np.asarray(b.convert('RGB'), dtype=np.float64)
    mse = float(np.mean((x-y)**2))
    # Explicitly documented local, non-overlapping 8x8 luminance-block SSIM. This
    # crop metric is descriptive; full-film SSIM below uses FFmpeg's native filter.
    x = x @ np.array([.299, .587, .114])
    y = y @ np.array([.299, .587, .114])
    h, w = x.shape
    h, w = h//8*8, w//8*8
    def blocks(z):
        return z[:h, :w].reshape(h//8, 8, w//8, 8).transpose(0,2,1,3).reshape(-1,64)
    x, y = blocks(x), blocks(y)
    mx, my = x.mean(axis=1), y.mean(axis=1)
    dx, dy = x-mx[:,None], y-my[:,None]
    vx, vy, cov = (dx*dx).mean(axis=1), (dy*dy).mean(axis=1), (dx*dy).mean(axis=1)
    ssim = ((2*mx*my + 2.55**2)*(2*cov + 7.65**2) /
            ((mx*mx + my*my + 2.55**2)*(vx+vy + 7.65**2)))
    return {'rgbPSNRdB': 10*math.log10(255**2/mse) if mse else None,
            'rgbMSE': mse, 'local8x8LuminanceSSIM': float(ssim.mean())}


def labelled_pair(master, view, title):
    width, height = master.size
    out = Image.new('RGB', (width, 2*height+64), '#f8f2e5')
    draw = ImageDraw.Draw(out)
    draw.text((6, 5), title + ' | MASTER, original-size pixels', fill='#102b46')
    out.paste(master, (0, 24))
    draw.text((6, height+31), 'VIEWING, original-size pixels', fill='#102b46')
    out.paste(view, (0, height+56))
    return out


def full_ssim():
    with tempfile.TemporaryDirectory(prefix='film-ssim-') as tmp:
        stats = Path(tmp) / 'stats.log'
        p = execute(['ffmpeg', '-hide_banner', '-v', 'info', '-xerror',
                     '-threads', '2', '-i', str(R/'output'/FILES['view']),
                     '-threads', '2', '-i', str(R/'output'/FILES['master']),
                     '-filter_complex_threads', '2', '-filter_complex',
                     f'[0:v:0][1:v:0]ssim=stats_file={stats}[q]',
                     '-map', '[q]', '-an', '-threads', '2', '-f', 'null', '-'])
        values = [float(x) for x in re.findall(r'All:([0-9.]+)', stats.read_text())]
        if len(values) != 4201:
            raise RuntimeError(f'Full-film SSIM compared {len(values)}, expected 4201 frames')
        summary = re.findall(r'SSIM Y:.*', p.stderr)[-1]
        return {'comparedVideoFrames': len(values), 'ffmpegSummary': summary,
                'allMean': float(np.mean(values)), 'allMinimum': min(values),
                'allPercentile1': float(np.percentile(values, 1)),
                'allPercentile5': float(np.percentile(values, 5)),
                'minimumFrameIndex': int(np.argmin(values)),
                'maximumFrameIndex': int(np.argmax(values))}


def compare():
    metrics = []
    regions = []
    for frame, purpose in SAMPLES:
        with Image.open(path('master', frame)) as m, Image.open(path('view', frame)) as v:
            if m.size != (1920,1080) or v.size != (1920,1080):
                raise RuntimeError('Frame extraction is not native 1080p')
            metrics.append({'frameIndex': frame, 'timelineSeconds': frame/30,
                            'purpose': purpose, **image_metrics(m,v)})
            for roi_frame, label, box in REGIONS:
                if roi_frame != frame:
                    continue
                mc, vc = m.crop(box), v.crop(box)
                target = QA / f'video-quality-detail-{frame:04d}-{label}.png'
                labelled_pair(mc, vc, f'{frame}/30 sec, {label}').save(target)
                regions.append({'frameIndex': frame, 'purpose': label, 'box': list(box),
                                'comparisonImage': target.name, **image_metrics(mc,vc)})
    chosen = [2575,3160,3843,4199]
    overview = Image.new('RGB', (1920, len(chosen)*562), '#f8f2e5')
    draw = ImageDraw.Draw(overview)
    for row, frame in enumerate(chosen):
        y = row*562
        draw.text((10,y+4), f'{frame/30:.3f}s MASTER (50% size)', fill='#102b46')
        draw.text((970,y+4), 'VIEWING (50% size)', fill='#102b46')
        for col,kind in enumerate(['master','view']):
            with Image.open(path(kind,frame)) as im:
                overview.paste(im.resize((960,540),Image.Resampling.LANCZOS),(col*960,y+22))
    overview.save(QA/'video-quality-overview.png')
    report = {
        'method': 'Native FFmpeg decode, exact 0-based frame selection; viewing compared to encoded master',
        'note': 'Compression comparison is relative to encoded master, not uncompressed scene output. No on-frame credits exist; CREDITS.md is delivered in the source package.',
        'sourceVideoSHA256': {kind:sha(R/'output'/name) for kind,name in FILES.items()},
        'fullFilmFFmpegSSIM': full_ssim(),
        'sampledFrames': metrics, 'labelRegions': regions,
        'localMetricDefinition': 'Mean SSIM over non-overlapping 8x8 RGB-derived luminance blocks, population variance, C1=2.55^2 and C2=7.65^2; descriptive crop metric only',
        'pixelReview': {'performed': False, 'notes': []},
        'browserRealtimePlaybackTested': False, 'audibleReviewTested': False,
    }
    (QA/'video-quality.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps({'fullFilmFFmpegSSIM':report['fullFilmFFmpegSSIM'],
                      'sampleCount':len(metrics),'labelRegionCount':len(regions),
                      'pixelReviewPerformed':False},indent=2))


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--extract',choices=['view','master','all'])
    p.add_argument('--compare',action='store_true')
    args=p.parse_args()
    QA.mkdir(exist_ok=True)
    if args.extract:
        for kind in FILES if args.extract=='all' else [args.extract]:
            extract(kind)
    if args.compare:
        compare()
    if not args.extract and not args.compare:
        p.error('Choose --extract and/or --compare')


if __name__=='__main__':
    main()
