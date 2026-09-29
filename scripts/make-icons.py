#!/usr/bin/env python3
"""生成 PWA 图标（PNG）。

图标是同一枚 SVG 标记的栅格化结果，用浏览器渲染可以保证圆角/渐变/抗锯齿
和线上实际显示完全一致，也避免为了 5 个尺寸引入 sharp / canvas 之类的大依赖。

用法：
    python3 scripts/make-icons.py            # 需要 playwright + chromium

产出（写入 public/）：
    icon-512.png  icon-192.png  icon-maskable-512.png
    apple-touch-icon.png (180)  favicon-32.png
"""

from __future__ import annotations

import os
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public"

# 有些环境只装了完整 chromium 而没有独立的 headless shell，这里显式指定可执行文件
CHROMIUM_CANDIDATES = [
    "/root/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome",
    "/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome",
]


def chromium_path() -> str | None:
    override = os.environ.get("DAYMARK_CHROMIUM")
    if override:
        return override
    for candidate in CHROMIUM_CANDIDATES:
        if pathlib.Path(candidate).exists():
            return candidate
    return None

TEMPLATE = """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><style>
  html, body {{ margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #08090C; }}
  .stage {{
    position: fixed; inset: 0; display: grid; place-items: center;
    background: radial-gradient(130% 110% at 22% -10%, #23204A 0%, #101124 42%, #08090C 78%);
  }}
  .mark {{ width: {size}%; height: {size}%; display: block; }}
</style></head>
<body><div class="stage">
<svg class="mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#8B7BFF" />
      <stop offset="100%" stop-color="#4F8DFF" />
    </linearGradient>
  </defs>
  <rect x="17" y="60" width="18" height="26" rx="9" fill="url(#g)" opacity="0.5" />
  <rect x="41" y="43" width="18" height="43" rx="9" fill="url(#g)" opacity="0.78" />
  <rect x="65" y="16" width="18" height="70" rx="9" fill="url(#g)" />
  <circle cx="74" cy="10.5" r="3.2" fill="#B9AFFF" />
</svg>
</div></body></html>
"""

TARGETS = [
    ("icon-512.png", 512, 62),
    ("icon-192.png", 192, 62),
    ("icon-maskable-512.png", 512, 46),  # maskable 需要收进 80% 安全区
    ("apple-touch-icon.png", 180, 62),
    ("favicon-32.png", 32, 78),
]


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    executable = chromium_path()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=executable,
            args=["--no-sandbox", "--force-color-profile=srgb"],
        )
        page = browser.new_page(device_scale_factor=1)
        for name, size, mark in TARGETS:
            page.set_viewport_size({"width": size, "height": size})
            page.set_content(TEMPLATE.format(size=mark))
            page.screenshot(path=str(OUT / name))
            print(f"{name:26} {size}x{size}")
        browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
