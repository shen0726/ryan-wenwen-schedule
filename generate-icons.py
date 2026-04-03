#!/usr/bin/env python3
"""Generate PWA icons with placeholder design"""
from PIL import Image, ImageDraw, ImageFont
import os

THEME_COLOR = (79, 70, 229)  # #4f46e5
WHITE = (255, 255, 255)
SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

def create_rounded_icon(size, text="RW", radius_ratio=0.2):
    """Create a rounded square icon with text"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Draw rounded rectangle background
    radius = int(size * radius_ratio)
    margin = 0
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=radius,
        fill=THEME_COLOR
    )

    # Add gradient effect (lighter at top)
    for i in range(size // 4):
        alpha = 20 - i
        if alpha > 0:
            draw.rounded_rectangle(
                [margin, margin, size - margin, margin + i * 2],
                radius=radius,
                fill=(255, 255, 255, alpha)
            )

    # Draw text
    font_size = size // 2
    try:
        # Try to use a system font
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except:
        font = ImageFont.load_default()

    # Get text bounding box
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    x = (size - text_width) // 2
    y = (size - text_height) // 2 - text_height // 4

    # Draw text with slight shadow
    shadow_offset = max(2, size // 64)
    draw.text((x + shadow_offset, y + shadow_offset), text, font=font, fill=(0, 0, 0, 50))
    draw.text((x, y), text, font=font, fill=WHITE)

    return img

def main():
    icons_dir = os.path.join(os.path.dirname(__file__), 'public', 'icons')
    os.makedirs(icons_dir, exist_ok=True)

    print("Generating PWA placeholder icons...")
    print(f"Theme: Ryan和Wenwen的日程表 (#4f46e5)")
    print()

    for size in SIZES:
        icon = create_rounded_icon(size, "RW")
        filepath = os.path.join(icons_dir, f"icon-{size}x{size}.png")
        icon.save(filepath, "PNG")
        print(f"✓ icon-{size}x{size}.png")

    print()
    print(f"All icons saved to: {icons_dir}")
    print("\nYou can replace these later with your cartoon image using:")
    print("  python3 generate-icons.py --custom your-image.png")

if __name__ == "__main__":
    main()
