#!/usr/bin/env bash
# Regenerates the small reference-set fixtures (open-and-view T19). Every file is synthetic and
# made here, so it is our own work (CC0). Needs: ImageMagick 7 (magick), cwebp, avifenc, heif-enc,
# python3. Large inputs (12 MP, 48 MP, >1 MiB metadata, the bomb) are built by the e2e spec itself.
set -euo pipefail
cd "$(dirname "$0")"

# A 48×32 reference: four solid quadrants — red top-left, green top-right, blue bottom-left,
# yellow bottom-right — so orientation and corners can be checked by colour.
magick -size 24x16 xc:'#ff0000' -size 24x16 xc:'#00ff00' +append \
  \( -size 24x16 xc:'#0000ff' -size 24x16 xc:'#ffff00' +append \) -append ref.png

magick -size 320x240 gradient:'#203060-#e0a040' photo.png
magick photo.png -quality 90 photo.jpg
cwebp -quiet -q 80 photo.png -o photo.webp
# A simple-format (VP8L) WebP over 1 MiB: its one chunk runs past the 1 MiB header window.
magick -seed 7 -size 720x540 xc: +noise Random noise.png
cwebp -quiet -lossless noise.png -o large-lossless.webp
rm noise.png
avifenc -q 60 photo.png photo.avif >/dev/null
heif-enc -q 50 photo.png -o photo.heic >/dev/null
magick -delay 50 -size 64x48 xc:'#ff0000' -size 64x48 xc:'#0000ff' -loop 0 animated.gif
# Animated and over the Downscale limit, so one open raises both info notices (AC-11b).
magick -delay 50 -size 6000x4000 xc:'#ff0000' xc:'#0000ff' -loop 0 big-animated.gif

# The refused formats only need a valid signature; keep them small.
magick -size 64x48 gradient:'#203060-#e0a040' small.png
magick small.png bitmap.bmp
magick small.png -compress lzw image.tiff
magick small.png image.psd
rm small.png
cat > drawing.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"><rect width="64" height="48" fill="#4c8dff"/></svg>
SVG

cp photo.png png-named.jpg
printf 'This is a plain text file, not an image.\n' > text-named.png

python3 - <<'PY'
import struct, zlib

jpg = open('photo.jpg', 'rb').read()
# Truncated inside the header: before the SOF marker, so the declared size is unreadable.
sof = next(i for i in range(2, len(jpg) - 1) if jpg[i] == 0xFF and jpg[i + 1] in (0xC0, 0xC2))
open('truncated.jpg', 'wb').write(jpg[:sof])

# Corrupt PNG: a valid header whose IDAT holds bytes that are not a zlib stream.
png = bytearray(open('photo.png', 'rb').read())
i = png.index(b'IDAT')
length = struct.unpack('>I', png[i - 4:i])[0]
png[i + 4:i + 4 + length] = bytes((x * 37 + 11) & 0xFF for x in range(length))
open('corrupt.png', 'wb').write(png)

# The 8 EXIF orientations: stored pixels pre-transformed so each displays as ref.png upright.
def exif(orientation):
    tiff = b'MM' + struct.pack('>HI', 42, 8) + struct.pack('>H', 1) \
        + struct.pack('>HHI', 0x0112, 3, 1) + struct.pack('>H', orientation) + b'\0\0' \
        + struct.pack('>I', 0)
    payload = b'Exif\0\0' + tiff
    return b'\xff\xe1' + struct.pack('>H', len(payload) + 2) + payload

import subprocess
inverse = {1: [], 2: ['-flop'], 3: ['-rotate', '180'], 4: ['-flip'], 5: ['-transpose'],
           6: ['-rotate', '270'], 7: ['-transverse'], 8: ['-rotate', '90']}
for o, ops in inverse.items():
    stored = f'orientation-{o}.jpg'
    subprocess.run(['magick', 'ref.png', *ops, '-strip', '-quality', '95', stored], check=True)
    data = open(stored, 'rb').read()
    rest = data[2:]
    if rest[:2] == b'\xff\xe0':  # drop JFIF APP0 so APP1 Exif comes first
        n = struct.unpack('>H', rest[2:4])[0]
        rest = rest[2 + n:]
    open(stored, 'wb').write(b'\xff\xd8' + exif(o) + rest)
PY

# The adjust fixtures: exact anchor patches and alpha patches (adjust test-plan §Test data).
python3 adjust-fixtures.py
