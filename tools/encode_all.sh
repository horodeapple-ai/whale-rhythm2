#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p output/segments qa/logs
starts=(0 600 1200 1800 2400 3000 3600)
ends=(600 1200 1800 2400 3000 3600 4201)
pids=()
for i in "${!starts[@]}"; do
  node tools/render_film.cjs --start="${starts[$i]}" --end="${ends[$i]}" --out="$PWD/output/segments/$(printf '%04d' "${starts[$i]}").mp4" > "qa/logs/render-$(printf '%04d' "${starts[$i]}").log" 2>&1 &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
: > output/concat.txt
for s in "${starts[@]}"; do printf "file 'segments/%04d.mp4'\n" "$s" >> output/concat.txt; done
ffmpeg -v error -y -f concat -safe 0 -i output/concat.txt -i assets/song.m4a -map 0:v -map 1:a -c copy -movflags +faststart -video_track_timescale 30000 'output/DeepSeek-接单喜剧-完整版母版.mp4'
ffmpeg -v error -y -i 'output/DeepSeek-接单喜剧-完整版母版.mp4' -map 0:v -an -c:v libx264 -preset slow -tune animation -b:v 880k -maxrate 1500k -bufsize 3000k -threads 6 -pass 1 -passlogfile output/view-pass -pix_fmt yuv420p -f null /dev/null
ffmpeg -v error -y -i 'output/DeepSeek-接单喜剧-完整版母版.mp4' -map 0:v -map 0:a -c:v libx264 -preset slow -tune animation -b:v 880k -maxrate 1500k -bufsize 3000k -threads 6 -pass 2 -passlogfile output/view-pass -pix_fmt yuv420p -c:a copy -movflags +faststart -video_track_timescale 30000 'output/DeepSeek-接单喜剧-1080p完整版.mp4'
python3 - <<'PY'
from pathlib import Path
p=Path('output/DeepSeek-接单喜剧-1080p完整版.mp4')
assert p.stat().st_size < 20_000_000, f'Viewing file is too large: {p.stat().st_size}'
print('VIEWING_BYTES', p.stat().st_size)
PY
