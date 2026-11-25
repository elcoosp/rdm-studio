"""Regenerate the PWA icon set from the official brand emblem.

`docs/logo-idea.png` (1600px raster of `docs/logo-idea.svg`) is the source
of truth: it is resized to the three PWA sizes, with the maskable variant
padded to the 80% safe zone per the W3C maskable icons spec.
"""

from PIL import Image

SRC = "docs/logo-idea.png"
OUT = "apps/web/public"


def resize_to(source: Image.Image, size: int) -> Image.Image:
    return source.resize((size, size), Image.LANCZOS)


def main() -> None:
    emblem = Image.open(SRC).convert("RGBA")

    # Square translucent-background icons.
    for size, name in ((192, "icon-192.png"), (512, "icon-512.png")):
        resize_to(emblem, size).save(f"{OUT}/{name}")
        print(f"wrote {name} ({size}px)")

    # Maskable: 80% safe zone — the logo shrinks into the inner 80% circle.
    base = 512
    inner = int(base * 0.80)
    shrunk = resize_to(emblem, inner)
    maskable = Image.new("RGBA", (base, base), (248, 250, 252, 255))  # #F8FAFC
    offset = (base - inner) // 2
    maskable.paste(shrunk, (offset, offset), shrunk)
    maskable.save(f"{OUT}/icon-maskable-512.png")
    print("wrote icon-maskable-512.png (80% safe zone)")


if __name__ == "__main__":
    main()
