"""Create an auditable answer-key candidate report from page marks.

This script never promotes candidates to production. It detects the white
selection circles and blue highlight rows, then writes confidence and source
coordinates so a human can verify each answer in the original image.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np
from PIL import Image


OCR_DIR = Path("data/ocr")
IMAGE_DIR = Path("images")
RAW_PATH = Path("data/questions.raw.json")
OUTPUT_PATH = Path("data/answer-candidates.json")


def is_marker(text: str) -> bool:
    return bool(re.match(r"^Câu\s+h[ỏoôơồ]i", text.strip(), re.IGNORECASE))


def option_id(text: str) -> str | None:
    normalized = text.strip().upper().replace("Ơ", "B")
    match = re.match(r"^([ABCD])\s*(?:[\).:]|$)", normalized)
    return match.group(1) if match else None


def find_circles(image: np.ndarray) -> list[float]:
    gray = image.mean(axis=2).astype(np.uint8)
    height, width = gray.shape
    region = gray[:, int(width * 0.06) : int(width * 0.27)] > 235
    seen = np.zeros_like(region, dtype=bool)
    centers: list[float] = []
    region_height, region_width = region.shape

    for y in range(region_height):
        for x in range(region_width):
            if not region[y, x] or seen[y, x]:
                continue
            stack = [(y, x)]
            seen[y, x] = True
            points: list[tuple[int, int]] = []
            while stack:
                yy, xx = stack.pop()
                points.append((yy, xx))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if not dy and not dx:
                            continue
                        ny, nx = yy + dy, xx + dx
                        if 0 <= ny < region_height and 0 <= nx < region_width and region[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            stack.append((ny, nx))
            ys = [point[0] for point in points]
            xs = [point[1] for point in points]
            box_width = max(xs) - min(xs) + 1
            box_height = max(ys) - min(ys) + 1
            if 120 <= len(points) <= 420 and 9 <= box_width <= 32 and 9 <= box_height <= 32:
                centers.append(sum(ys) / len(ys) / height)
    return sorted(centers)


def make_groups(block: list[dict]) -> list[dict]:
    groups: list[dict] = []
    current: dict | None = None
    question_done = False

    for line in block[1:]:
        text = line["text"].strip()
        center_top = 1 - (line["y"] + line["height"] / 2)
        detected_id = option_id(text)
        if not question_done:
            if "?" in text or detected_id:
                question_done = True
                if detected_id:
                    current = {"label": detected_id, "ys": [center_top], "lines": [line]}
            continue

        starts = bool(detected_id) or current is None or (line["x"] < 0.185 and len(groups) < 4)
        if starts:
            if current is not None:
                groups.append(current)
            current = {"label": detected_id, "ys": [center_top], "lines": [line]}
        elif current is not None:
            current["ys"].append(center_top)
            current["lines"].append(line)

    if current is not None:
        groups.append(current)
    return groups[:4]


def blue_score(image: np.ndarray, line: dict) -> float:
    height, width = image.shape[:2]
    rgb = image.astype(int)
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    score = ((blue - red) + (green - red)).clip(min=0)
    y1 = max(0, int((1 - line["y"] - line["height"]) * height))
    y2 = min(height, int((1 - line["y"]) * height) + 1)
    x1 = max(0, int(line["x"] * width) - 5)
    x2 = min(width, int((line["x"] + line["width"]) * width) + 5)
    return float(score[y1:y2, x1:x2].mean()) if y2 > y1 and x2 > x1 else 0.0


raw_questions = json.loads(RAW_PATH.read_text(encoding="utf-8"))
raw_by_image: dict[str, list[dict]] = {}
for question in raw_questions:
    raw_by_image.setdefault(question["source"]["image"], []).append(question)

candidates: list[dict] = []
for json_path in sorted(OCR_DIR.glob("*.json")):
    image_name = f"{json_path.stem}.jpg"
    image_path = IMAGE_DIR / image_name
    if not image_path.exists():
        continue
    lines = [line for line in json.loads(json_path.read_text(encoding="utf-8")) if line["text"].strip()]
    marker_indexes = [index for index, line in enumerate(lines) if is_marker(line["text"])]
    image = np.array(Image.open(image_path).convert("RGB"))
    circles = find_circles(image)

    for index, marker_index in enumerate(marker_indexes):
        end = marker_indexes[index + 1] if index + 1 < len(marker_indexes) else len(lines)
        block = lines[marker_index:end]
        groups = make_groups(block)
        raw_on_page = raw_by_image.get(image_name, [])
        question = raw_on_page[index] if index < len(raw_on_page) else None
        if question is None:
            continue

        group_scores = [max((blue_score(image, line) for line in group["lines"]), default=0.0) for group in groups]
        blue_index = int(np.argmax(group_scores)) if group_scores and max(group_scores) >= 30 else None
        top_values = [1 - (line["y"] + line["height"] / 2) for line in block]
        lower, upper = min(top_values, default=0.0) - 0.02, max(top_values, default=1.0) + 0.02
        page_circles = [circle for circle in circles if lower <= circle <= upper]
        circle_index = None
        circle_distance = None
        if groups and page_circles:
            circle = min(page_circles, key=lambda value: min(abs(value - np.mean(group["ys"])) for group in groups))
            distances = [abs(circle - float(np.mean(group["ys"]))) for group in groups]
            circle_index = int(np.argmin(distances))
            circle_distance = round(distances[circle_index], 4)

        selected_index = blue_index if blue_index is not None else circle_index
        marker_type = "blue-highlight" if blue_index is not None else ("selection-circle" if circle_index is not None else "none")
        confidence = 0.0
        if blue_index is not None:
            confidence = min(0.99, max(0.55, group_scores[blue_index] / 100))
        elif circle_index is not None:
            confidence = max(0.35, 0.92 - (circle_distance or 0) * 8)

        candidates.append({
            "questionId": question["id"],
            "source": question["source"],
            "predictedOptionIndex": selected_index,
            "predictedOptionId": ("ABCD"[selected_index] if selected_index is not None and selected_index < 4 else None),
            "markerType": marker_type,
            "confidence": round(confidence, 3),
            "groupCount": len(groups),
            "circleCountOnPage": len(circles),
            "blueScores": [round(value, 1) for value in group_scores],
        })

OUTPUT_PATH.write_text(json.dumps(candidates, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {len(candidates)} answer candidates to {OUTPUT_PATH}")
