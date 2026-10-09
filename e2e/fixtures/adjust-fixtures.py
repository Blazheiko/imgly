"""The adjust fixtures (adjust test-plan §Test data), written byte by byte so they are exact.

anchors.png        56×8 RGB: 8×8 patches of mid-grey 128, black, white, red, green, blue, yellow.
alpha-patches.png  24×16 RGBA: 4×4 patches, alpha 0, 1, 64, 128, 254, 255 across, four colours down.
mild-cast.png      160×120 RGB: a textured gradient, a little dark and flat, with a mild warm, magenta
                   cast, so Auto's four values all stay inside ±50 (AC-13 cross-engine).
large-cast.png     1200×800 RGB: a finer textured gradient with a mild cool, green cast, longer than
                   Auto's 512 px sample, so the engines' reduced (NEAREST) sample is compared too.
"""
import struct
import zlib


def png(path, width, height, rows, rgba):
    def chunk(kind, data):
        body = kind + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body))

    raw = b''.join(b'\0' + bytes(row) for row in rows)
    header = struct.pack('>IIBBBBB', width, height, 8, 6 if rgba else 2, 0, 0, 0)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', zlib.compress(raw, 9))
    open(path, 'wb').write(data + chunk(b'IEND', b''))


ANCHORS = [(128, 128, 128), (0, 0, 0), (255, 255, 255), (255, 0, 0), (0, 255, 0), (0, 0, 255),
           (255, 255, 0)]
PATCH = 8
png('anchors.png', PATCH * len(ANCHORS), PATCH,
    [[c for colour in ANCHORS for _ in range(PATCH) for c in colour] for _ in range(PATCH)],
    rgba=False)

ALPHAS = [0, 1, 64, 128, 254, 255]
COLOURS = [(200, 120, 40), (40, 160, 220), (128, 128, 128), (250, 250, 250)]
SIDE = 4
png('alpha-patches.png', SIDE * len(ALPHAS), SIDE * len(COLOURS),
    [[c for a in ALPHAS for _ in range(SIDE) for c in (*colour, a)]
     for colour in COLOURS for _ in range(SIDE)],
    rgba=True)


def textured(width, height, gains, period):
    """A diagonal gradient from 40 to 200 with a ±18 texture of the given period, times `gains`."""
    rows = []
    for y in range(height):
        row = []
        for x in range(width):
            base = 40 + 160 * (x + y) / (width + height - 2)
            texture = 18 * (((x * 7 + y * 13) % period) / (period - 1) * 2 - 1)
            v = base + texture
            row.extend(min(255, max(0, round(v * g))) for g in gains)
        rows.append(row)
    return rows


png('mild-cast.png', 160, 120, textured(160, 120, (1.08, 0.96, 0.92), 9), rgba=False)
png('large-cast.png', 1200, 800, textured(1200, 800, (0.93, 1.05, 1.04), 5), rgba=False)
