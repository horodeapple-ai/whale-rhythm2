"""Strict final-delivery checks. Read media only; never renders or encodes a film."""
from pathlib import Path
from fractions import Fraction
import argparse
import concurrent.futures
import datetime
import hashlib
import json
import subprocess
import sys

R = Path(__file__).resolve().parent.parent
FILES = ['DeepSeek-接单喜剧-1080p完整版.mp4', 'DeepSeek-接单喜剧-完整版母版.mp4']


def run(args):
    return subprocess.run(args, capture_output=True, text=True, check=True).stdout


def sha256(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def probe(path):
    return json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format',
                           '-show_data_hash', 'sha256', '-of', 'json', str(path)]))


def packets(path):
    return json.loads(run(['ffprobe', '-v', 'error', '-select_streams', 'a:0',
                           '-show_packets', '-show_data_hash', 'sha256',
                           '-show_entries', 'packet=pts,dts,duration,size,data_hash',
                           '-of', 'json', str(path)]))['packets']


def packet_digest(packet_list):
    """Digest of ordered raw 32-byte per-packet SHA256s, not of concatenated payloads."""
    return hashlib.sha256(b''.join(bytes.fromhex(p['data_hash'].split(':', 1)[1])
                                   for p in packet_list)).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', choices=['master', 'view'], help='Verify one finished file; retain a hash-revalidated passing result for the other')
    args = parser.parse_args()
    selected = FILES if not args.only else [FILES[1] if args.only == 'master' else FILES[0]]
    source_path = R / 'assets/song.m4a'
    source = packets(source_path)
    expected = [p['data_hash'] for p in source]
    source_a = next(s for s in probe(source_path)['streams'] if s['codec_type'] == 'audio')
    source_digest = packet_digest(source)
    source_sha = sha256(source_path)
    reports = []

    def verify(filename):
        path = R / 'output' / filename
        report = {'file': filename, 'passed': False, 'failures': [], 'checkedAtUTC': datetime.datetime.now(datetime.timezone.utc).isoformat()}
        def check(condition, name):
            if not condition:
                report['failures'].append(name)
        try:
            before = path.stat()
            j = probe(path)
            v = next(s for s in j['streams'] if s['codec_type'] == 'video')
            a = next(s for s in j['streams'] if s['codec_type'] == 'audio')
            report.update({
                'bytes': before.st_size, 'sha256': sha256(path),
                'videoFrames': int(v['nb_frames']),
                'audioDeclaredFrames': int(a['nb_frames']),
                'size': [v['width'], v['height']], 'fps': v['r_frame_rate'],
                'averageFps': v['avg_frame_rate'], 'videoCodec': v['codec_name'],
                'pixelFormat': v['pix_fmt'], 'videoBitrate': v.get('bit_rate'),
                'videoDuration': v['duration'], 'videoTimeBase': v['time_base'],
                'audioCodec': a['codec_name'], 'audioSampleRate': a['sample_rate'],
                'audioChannels': a['channels'], 'audioDuration': a['duration'],
                'audioDurationSamples': int(a['duration_ts']),
                'containerDuration': j['format']['duration'],
            })
            check(report['size'] == [1920, 1080], 'Video must be 1920 x 1080')
            check(Fraction(v['r_frame_rate']) == 30 and Fraction(v['avg_frame_rate']) == 30,
                  'Video frame rate must be constant 30 fps')
            check(int(v['nb_frames']) == 4201, 'Video must declare 4201 frames')
            check(v['codec_name'] == 'h264' and v['pix_fmt'] == 'yuv420p',
                  'Expected H.264 yuv420p playback delivery')
            check(abs(float(v['duration']) - 4201 / 30) < .00001,
                  'Video duration must cover all 4201 frames')
            check(abs(float(a['duration']) - 140.032) < .00001,
                  'Original audio duration must be 140.032 seconds')
            check(140.032 <= float(j['format']['duration']) <= 140.0667,
                  'Container duration outside expected bounds')
            check(float(a.get('start_time', 0)) == 0 and float(v.get('start_time', 0)) == 0,
                  'Video and audio must both start at zero')
            fields = ['codec_name', 'profile', 'sample_rate', 'channels', 'channel_layout',
                      'time_base', 'duration_ts', 'extradata_hash']
            mismatches = {k: [source_a.get(k), a.get(k)] for k in fields
                          if source_a.get(k) != a.get(k)}
            report['audioStreamParameterMismatches'] = mismatches
            check(not mismatches, 'Original AAC stream parameters changed')
            actual = packets(path)
            payload_equal = [p['data_hash'] for p in actual] == expected
            timing_fields = ('pts', 'dts', 'duration', 'size')
            timing_equal = ([[p.get(k) for k in timing_fields] for p in actual] ==
                            [[p.get(k) for k in timing_fields] for p in source])
            report.update({'originalAudioPackets': len(source), 'audioPackets': len(actual),
                           'audioPayloadsBitIdentical': payload_equal,
                           'audioPacketTimingAndSizesIdentical': timing_equal,
                           'orderedAudioPacketSHA256Digest': packet_digest(actual)})
            check(payload_equal, 'Original AAC packet payload hashes/order changed')
            check(timing_equal, 'Original AAC packet timestamps/durations/sizes changed')
            check(int(a['nb_frames']) == len(source), 'AAC packet/frame count changed')
            # This decodes both streams to the end. -xerror prevents errors being hidden
            # by FFmpeg's otherwise-successful completion after a damaged frame.
            proc = subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-xerror',
                                   '-err_detect', 'explode', '-threads', '2', '-i', str(path),
                                   '-map', '0:v:0', '-map', '0:a:0', '-threads', '2',
                                   '-f', 'null', '-progress', 'pipe:1', '-'],
                                  capture_output=True, text=True)
            decoded_frames = [int(line.split('=')[1]) for line in proc.stdout.splitlines()
                              if line.startswith('frame=')]
            report.update({'fullDecodeExitCode': proc.returncode,
                           'fullDecodeFrames': decoded_frames[-1] if decoded_frames else None,
                           'fullDecodePassed': proc.returncode == 0 and not proc.stderr.strip(),
                           'fullDecodeErrors': proc.stderr.strip(),
                           'decodeProgressEnded': 'progress=end' in proc.stdout})
            check(report['fullDecodePassed'], 'Full video/audio decode reported an error')
            check(report['fullDecodeFrames'] == 4201, 'Full decode did not produce 4201 video frames')
            check(report['decodeProgressEnded'], 'Full decode did not reach end')
            if '1080p' in filename:
                report['strictByteLimit'] = 20_000_000
                report['bytesUnderLimit'] = 20_000_000 - before.st_size
                check(before.st_size < 20_000_000, 'Viewing file must be strictly under 20,000,000 bytes')
            after = path.stat()
            check((before.st_size, before.st_mtime_ns) == (after.st_size, after.st_mtime_ns),
                  'File changed while being verified')
        except Exception as exc:
            report['failures'].append(f'{type(exc).__name__}: {exc}')
        report['passed'] = not report['failures']
        return report

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        reports = list(pool.map(verify, selected))
    selected_passed = all(r['passed'] for r in reports)
    if args.only and (R / 'qa/video-verification.json').exists():
        previous = json.loads((R / 'qa/video-verification.json').read_text())
        if previous.get('originalSourceAudioSHA256') == source_sha:
            for old in previous.get('files', []):
                p = R / 'output' / old['file']
                if old['file'] not in selected and old.get('passed') and p.exists() and sha256(p) == old.get('sha256'):
                    reports.append(old)
    reports.sort(key=lambda r: FILES.index(r['file']))
    complete = {r['file'] for r in reports} == set(FILES)
    out = {
        'complete': complete,
        'passed': complete and all(r['passed'] for r in reports),
        'checkedAtUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'originalSourceAudioSHA256': source_sha,
        'originalAudioPackets': len(source),
        'originalAudioPayloadBytes': sum(int(p['size']) for p in source),
        'originalOrderedAudioPacketSHA256Digest': source_digest,
        'packetDigestDefinition': 'SHA256 of concatenated ordered 32-byte AAC packet SHA256 digests',
        'ffmpegVersion': run(['ffmpeg', '-version']).splitlines()[0],
        'files': reports, 'browserRealtimePlaybackTested': False, 'audibleReviewTested': False,
    }
    target = R / 'qa/video-verification.json'
    target.parent.mkdir(exist_ok=True)
    temporary = target.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(out, indent=2, ensure_ascii=False) + '\n')
    temporary.replace(target)
    print(json.dumps(out, indent=2, ensure_ascii=False))
    return 0 if selected_passed else 1


if __name__ == '__main__':
    sys.exit(main())
