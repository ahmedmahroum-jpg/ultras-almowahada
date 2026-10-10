"""Encode the deterministic 8-second HTML motion preview using local FFmpeg libraries."""
from pathlib import Path
import av
from PIL import Image

root = Path(__file__).resolve().parents[1]
out = root / 'output' / 'motion'
out.mkdir(parents=True, exist_ok=True)
frames = sorted((root / 'tmp' / 'motion-frames').glob('*.png'))
assert len(frames) == 192, f'Expected 192 frames, got {len(frames)}'
with av.open(str(out / 'ultras-motion-preview.mp4'), 'w') as container:
    stream = container.add_stream('libx264', rate=24)
    stream.width, stream.height = 1080, 1920
    stream.pix_fmt = 'yuv420p'
    stream.options = {'crf':'19', 'preset':'medium'}
    for p in frames:
        with Image.open(p) as im:
            frame = av.VideoFrame.from_image(im.convert('RGB'))
            for packet in stream.encode(frame):
                container.mux(packet)
    for packet in stream.encode():
        container.mux(packet)
with av.open(str(out / 'ultras-motion-preview.mp4')) as c:
    s=c.streams.video[0]
    print({'width':s.width,'height':s.height,'frames':s.frames,'fps':str(s.average_rate),'duration_seconds':float(s.duration*s.time_base)})
