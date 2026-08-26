from pathlib import Path
import math
import struct
import zlib


def chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)


def write_png(path: Path, size: int) -> None:
    bg = (17, 19, 24, 255)
    card = (26, 29, 36, 255)
    fg = (248, 247, 243, 255)
    accent = (88, 174, 254, 255)
    center = size / 2
    radius = size * 0.38
    stroke = max(5, size // 26)
    pixels = bytearray()

    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            color = card if math.hypot(x - center, y - center) < radius else bg
            if abs(y - size * 0.34) < stroke and size * 0.34 < x < size * 0.66:
                color = accent
            if abs((y - size * 0.48) - 0.55 * (x - size * 0.34)) < stroke and size * 0.28 < x < size * 0.48 and size * 0.42 < y < size * 0.62:
                color = fg
            if abs((y - size * 0.60) + 1.0 * (x - size * 0.55)) < stroke and size * 0.45 < x < size * 0.73 and size * 0.32 < y < size * 0.63:
                color = fg
            if abs(y - size * 0.72) < stroke and size * 0.32 < x < size * 0.68:
                color = fg
            row.extend(color)
        pixels.extend(row)

    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(bytes(pixels), 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def main() -> None:
    public = Path("public")
    public.mkdir(exist_ok=True)
    write_png(public / "icon-192.png", 192)
    write_png(public / "icon-512.png", 512)
    write_png(public / "apple-touch-icon.png", 180)


if __name__ == "__main__":
    main()
