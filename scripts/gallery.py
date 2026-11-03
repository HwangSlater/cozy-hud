"""캐릭터 모음 그림(docs/images/characters.png)을 core/data/characters.json 에서 만든다.

실행: python scripts/gallery.py
터미널 칸 비율(가로 1 : 세로 반 줄)을 따라 픽셀 하나를 가로 9 × 세로 10 으로 그린다.
"""
import json
import pathlib

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
PIXEL_W, PIXEL_H = 9, 10
CELL_W, CELL_H = 200, 150
PER_ROW = 7
BG = (20, 20, 20)
CARD = (30, 30, 30)
TEXT = (220, 220, 220)
FONT_CANDIDATES = ["C:/Windows/Fonts/malgun.ttf", "/System/Library/Fonts/AppleSDGothicNeo.ttc", "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"]


def font(size):
    for path in FONT_CANDIDATES:
        if pathlib.Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def hex_rgb(value):
    return tuple(int(value[i:i + 2], 16) for i in (1, 3, 5))


def main():
    data = json.loads((ROOT / "core/data/characters.json").read_text(encoding="utf-8"))
    chars = data["characters"] if isinstance(data, dict) else data
    rows = (len(chars) + PER_ROW - 1) // PER_ROW
    img = Image.new("RGB", (CELL_W * PER_ROW + 20, CELL_H * rows + 20), BG)
    draw = ImageDraw.Draw(img)
    label_font = font(16)
    for i, ch in enumerate(chars):
        x0 = 10 + (i % PER_ROW) * CELL_W
        y0 = 10 + (i // PER_ROW) * CELL_H
        draw.rounded_rectangle([x0 + 4, y0 + 4, x0 + CELL_W - 4, y0 + CELL_H - 4], 8, fill=CARD)
        art = ch["rows"]
        w, h = len(art[0]) * PIXEL_W, len(art) * PIXEL_H
        ax, ay = x0 + (CELL_W - w) // 2, y0 + 16 + (100 - h) // 2
        for r, line in enumerate(art):
            for c, px in enumerate(line):
                color = ch["colors"].get(px)
                if px == "." or not color:
                    continue
                draw.rectangle([ax + c * PIXEL_W, ay + r * PIXEL_H, ax + (c + 1) * PIXEL_W - 1, ay + (r + 1) * PIXEL_H - 1], fill=hex_rgb(color))
        tw = draw.textlength(ch["name"], font=label_font)
        draw.text((x0 + (CELL_W - tw) / 2, y0 + CELL_H - 34), ch["name"], fill=TEXT, font=label_font)
    out = ROOT / "docs/images/characters.png"
    img.save(out)
    print(out)


if __name__ == "__main__":
    main()
