"""Create non-destructive OCR working copies without touching images/."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageOps


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--crop-margin",
        type=int,
        default=0,
        help="Crop this many pixels from every edge after EXIF orientation.",
    )
    parser.add_argument(
        "--deskew-angle",
        type=float,
        default=0.0,
        help="Rotate every working copy by this angle in degrees (positive is counter-clockwise).",
    )
    args = parser.parse_args()
    if args.crop_margin < 0:
        parser.error("--crop-margin must be non-negative")
    args.output.mkdir(parents=True, exist_ok=True)
    report: list[dict[str, object]] = []
    for source in sorted(args.source.glob("*.jpg")):
        image = ImageOps.exif_transpose(Image.open(source)).convert("L")
        operations = ["exif-transpose", "grayscale"]
        if args.crop_margin:
            margin = min(args.crop_margin, (image.width - 1) // 2, (image.height - 1) // 2)
            image = image.crop((margin, margin, image.width - margin, image.height - margin))
            operations.append(f"crop-margin-{margin}px")
        if args.deskew_angle:
            image = image.rotate(args.deskew_angle, expand=True, fillcolor=255)
            operations.append(f"deskew-{args.deskew_angle:g}deg")
        image = ImageOps.autocontrast(image)
        operations.append("autocontrast")
        if image.width < 1800:
            image = image.resize((image.width * 2, image.height * 2), Image.Resampling.LANCZOS)
            operations.append("2x-upscale-if-needed")
        destination = args.output / f"{source.stem}.png"
        image.save(destination, optimize=True)
        report.append({"source": str(source), "output": str(destination), "size": list(image.size), "operations": operations})
    (args.output / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Preprocessed {len(report)} images into {args.output}")


if __name__ == "__main__":
    main()
