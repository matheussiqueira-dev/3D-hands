"""Generate the favicon set and the Open Graph card (ms-tokens A.9 recipe).

Outputs (committed): public/favicon.svg, public/favicon.ico, public/apple-touch-icon.png,
public/icon-512.png and public/og.png. The "3D" monogram is IBM Plex Sans 700,
converted to outlines because fonts do not load inside favicons.

Usage: python scripts/generate_brand_assets.py   (needs requirements-dev.txt)
"""

from __future__ import annotations

import io
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
FONT_FILE = PUBLIC / "fonts" / "ibm-plex-sans-latin-wght-normal.v5-3-0.woff2"

# Values from ms-tokens.css v1.0 (assets are on the literal-colour allowlist).
SURFACE = "#13161c"
CANVAS = "#0b0d10"
TEXT = "#e4e7ec"
TEXT_SECONDARY = "#a3abb8"
TEXT_TERTIARY = "#8a93a3"
ACCENT = "#00f2fe"
OUTLINE_RGBA = (228, 231, 236, 46)  # rgba(228,231,236,0.18)

MONOGRAM = "3D"
PRODUCT = "3D Hands"
VALUE_LINE = "Gire, mova e troque a forma de um objeto 3D com a mão."
STACK = ["Three.js", "MediaPipe Hands", "WebGL", "JavaScript", "Python"]


def plex_bold() -> TTFont:
    font = TTFont(str(FONT_FILE))
    if "fvar" in font:
        font = instantiateVariableFont(font, {"wght": 700})
    font.flavor = None
    return font


def font_bytes(font: TTFont) -> bytes:
    buf = io.BytesIO()
    font.save(buf)
    return buf.getvalue()


def monogram_path(font: TTFont, box: float = 32.0, cap_px: float = 13.0, baseline: float = 20.0) -> str:
    """SVG path data for the monogram, centred horizontally in a box-wide square."""
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    cap = font["OS/2"].sCapHeight or 700
    scale = cap_px / cap
    names = [cmap[ord(ch)] for ch in MONOGRAM]
    tracking = -0.02 * font["head"].unitsPerEm

    advance = 0.0
    placements = []
    for i, name in enumerate(names):
        placements.append((name, advance))
        advance += glyph_set[name].width + (tracking if i < len(names) - 1 else 0)

    bounds = BoundsPen(glyph_set)
    for name, x in placements:
        glyph_set[name].draw(TransformPen(bounds, (1, 0, 0, 1, x, 0)))
    x_min, _, x_max, _ = bounds.bounds
    offset_x = (box - (x_max - x_min) * scale) / 2 - x_min * scale

    pen = SVGPathPen(glyph_set, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
    for name, x in placements:
        transform = (scale, 0, 0, -scale, offset_x + x * scale, baseline)
        glyph_set[name].draw(TransformPen(pen, transform))
    return pen.getCommands()


def write_svg(path_data: str) -> None:
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">'
        f'<rect x="0.5" y="0.5" width="31" height="31" rx="7" fill="{SURFACE}" '
        'stroke="rgba(228,231,236,0.18)" stroke-width="1"/>'
        f'<path d="{path_data}" fill="{TEXT}"/>'
        f'<rect x="11" y="23" width="10" height="2" fill="{ACCENT}"/>'
        "</svg>\n"
    )
    (PUBLIC / "favicon.svg").write_text(svg, encoding="utf-8", newline="\n")


def draw_icon(size: int, plex: bytes, opaque: bool) -> Image.Image:
    """Raster version of the favicon at `size` px (rounded unless opaque)."""
    k = size / 32
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if opaque:
        d.rectangle([0, 0, size, size], fill=SURFACE)
    else:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=7 * k, fill=SURFACE, outline=OUTLINE_RGBA, width=max(1, round(k / 2)))
    font = ImageFont.truetype(io.BytesIO(plex), size=round(18.6 * k))
    d.text((size / 2, 20 * k), MONOGRAM, font=font, fill=TEXT, anchor="ms")
    d.rectangle([11 * k, 23 * k, 21 * k - 1, 25 * k - 1], fill=ACCENT)
    return img


def mono_font(size: int) -> ImageFont.FreeTypeFont:
    for candidate in ("C:/Windows/Fonts/consola.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"):
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default(size=size)


def draw_og(plex: bytes, plex_regular: bytes) -> Image.Image:
    w, h = 1200, 630
    img = Image.new("RGB", (w, h), CANVAS)

    # Soft corner halo: allowed only on this off-site asset (A.9).
    halo = Image.new("L", (w, h), 0)
    ImageDraw.Draw(halo).ellipse([w - 420, -320, w + 260, 300], fill=40)
    halo = halo.filter(ImageFilter.GaussianBlur(120))
    img.paste(Image.new("RGB", (w, h), ACCENT), mask=halo)

    d = ImageDraw.Draw(img)
    left = 88
    d.rectangle([left, 88, left + 56, 92], fill=ACCENT)
    d.text((left, 128), "Projeto · Matheus Siqueira", font=ImageFont.truetype(io.BytesIO(plex_regular), 28), fill=TEXT_TERTIARY)
    d.text((left, 176), PRODUCT, font=ImageFont.truetype(io.BytesIO(plex), 108), fill=TEXT)
    d.text((left, 322), VALUE_LINE, font=ImageFont.truetype(io.BytesIO(plex_regular), 34), fill=TEXT_SECONDARY)

    chip_font = ImageFont.truetype(io.BytesIO(plex), 24)
    x, y = left, 420
    for label in STACK:
        tw = d.textlength(label, font=chip_font)
        d.rounded_rectangle([x, y, x + tw + 36, y + 48], radius=6, outline=TEXT_TERTIARY, width=2)
        d.text((x + 18, y + 24), label, font=chip_font, fill=TEXT, anchor="lm")
        x += tw + 36 + 14

    d.text((w - 88, h - 72), "www.matheussiqueira.dev", font=mono_font(26), fill=TEXT_TERTIARY, anchor="rs")
    return img


def main() -> None:
    bold = plex_bold()
    write_svg(monogram_path(bold))
    plex = font_bytes(bold)
    regular = TTFont(str(FONT_FILE))
    regular = instantiateVariableFont(regular, {"wght": 400})
    regular.flavor = None
    plex_regular = font_bytes(regular)

    draw_icon(32, plex, opaque=False).save(PUBLIC / "favicon.ico", sizes=[(32, 32)])
    draw_icon(180, plex, opaque=True).convert("RGB").save(PUBLIC / "apple-touch-icon.png", optimize=True)
    draw_icon(512, plex, opaque=False).save(PUBLIC / "icon-512.png", optimize=True)
    draw_og(plex, plex_regular).save(PUBLIC / "og.png", optimize=True)
    print("wrote favicon.svg, favicon.ico, apple-touch-icon.png, icon-512.png, og.png")


if __name__ == "__main__":
    main()
