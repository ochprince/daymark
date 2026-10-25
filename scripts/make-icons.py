#!/usr/bin/env python3
"""生成 Daymark 的图标与启动图（PNG）。

同一枚 SVG 标记栅格化成所有尺寸：用浏览器渲染可以保证圆角/渐变/抗锯齿
和线上实际显示完全一致，也避免为了十几个尺寸引入 sharp / canvas 之类的大依赖。

用法：
    python3 scripts/make-icons.py              # PWA 图标 + iOS/Android 原生资源，全部重画
    python3 scripts/make-icons.py --web        # 只画 public/ 里的 PWA 图标
    python3 scripts/make-icons.py --native     # 只画 ios/ 与 android/ 里的原生资源
    python3 scripts/make-icons.py --only icon-1024.png,ic_launcher.png

需要 playwright + chromium（本机 1.8G 内存跑得动：只开一个 page，逐张换尺寸）。

产出：
  public/            icon-1024.png  icon-512.png  icon-192.png
                     icon-maskable-512.png  apple-touch-icon.png  favicon-32.png
  ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png   (1024，App Store 图标)
  ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732*.png
  android/.../mipmap-*/ic_launcher.png  ic_launcher_round.png  ic_launcher_foreground.png
  android/.../drawable*/splash.png
  android/.../drawable-nodpi/ic_stat_daymark.png                      (通知栏纯白剪影)
"""

from __future__ import annotations

import argparse
import dataclasses
import os
import pathlib
import struct
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public"
IOS_ASSETS = ROOT / "ios/App/App/Assets.xcassets"
ANDROID_RES = ROOT / "android/app/src/main/res"

# 有些环境只装了完整 chromium 而没有独立的 headless shell，这里显式指定可执行文件
CHROMIUM_CANDIDATES = [
    "/root/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome",
    "/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome",
]

# 品牌底色：深色皮肤的底。启动图与 Android 图标背景都用它，避免开屏闪白。
INK = "#08090C"

TEMPLATE = """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><style>
  html, body {{ margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden;
    background: {page_bg}; }}
  .stage {{
    position: fixed; inset: 0; display: grid; place-items: center;
    background: {stage_bg};
    border-radius: {radius};
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
  <rect x="17" y="60" width="18" height="26" rx="9" fill="{fill}" opacity="{o1}" />
  <rect x="41" y="43" width="18" height="43" rx="9" fill="{fill}" opacity="{o2}" />
  <rect x="65" y="16" width="18" height="70" rx="9" fill="{fill}" opacity="{o3}" />
  <circle cx="74" cy="10.5" r="3.2" fill="{dot}" />
</svg>
</div></body></html>
"""

# 背景三种：渐变（默认，和线上图标一致）、纯墨色、透明
BG = {
    "gradient": "radial-gradient(130% 110% at 22% -10%, #23204A 0%, #101124 42%, #08090C 78%)",
    "flat": INK,
    "none": "transparent",
}


@dataclasses.dataclass(frozen=True)
class Target:
    path: pathlib.Path
    width: int
    height: int
    #: 标记占画布短边的百分比
    mark: int
    bg: str = "gradient"
    #: 圆形裁切（Android 的 round 图标）
    round: bool = False
    #: 纯色剪影（通知栏小图标必须是白色单色），给了值就忽略渐变
    tint: str | None = None


def png_size(path: pathlib.Path) -> tuple[int, int]:
    """只读 PNG 头里的 IHDR 拿到宽高（不引 Pillow）。"""
    with open(path, "rb") as handle:
        head = handle.read(33)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path} 不是 PNG")
    width, height = struct.unpack(">II", head[16:24])
    return width, height


def web_targets() -> list[Target]:
    return [
        Target(OUT / "icon-1024.png", 1024, 1024, 62),  # App Store / 高清 PWA
        Target(OUT / "icon-512.png", 512, 512, 62),
        Target(OUT / "icon-192.png", 192, 192, 62),
        Target(OUT / "icon-maskable-512.png", 512, 512, 46),  # 收进 80% 安全区
        Target(OUT / "apple-touch-icon.png", 180, 180, 62),
        Target(OUT / "favicon-32.png", 32, 32, 78),
    ]


def native_targets() -> list[Target]:
    targets: list[Target] = []

    # iOS：App Store 图标只收一张 1024（不许透明、不许自己画圆角，系统会切）
    targets.append(Target(IOS_ASSETS / "AppIcon.appiconset/AppIcon-512@2x.png", 1024, 1024, 62))
    # iOS 启动图：模板是三张 2732 的图，标记占比小，让开屏安静
    for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
        targets.append(Target(IOS_ASSETS / f"Splash.imageset/{name}", 2732, 2732, 20))

    # Android 传统图标 + 圆形图标（48dp 基准，各密度倍率）
    density = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
    for name, scale in density.items():
        size = int(48 * scale)
        targets.append(Target(ANDROID_RES / f"mipmap-{name}/ic_launcher.png", size, size, 62))
        targets.append(
            Target(ANDROID_RES / f"mipmap-{name}/ic_launcher_round.png", size, size, 62, round=True)
        )
        # 自适应图标前景：108dp 画布，标记只占中间 66dp 安全区
        fg = int(108 * scale)
        targets.append(
            Target(ANDROID_RES / f"mipmap-{name}/ic_launcher_foreground.png", fg, fg, 52, bg="none")
        )

    # Android 启动图：沿用模板里每个文件的原始像素尺寸，只换内容
    for splash in sorted(ANDROID_RES.glob("drawable*/splash.png")):
        width, height = png_size(splash)
        targets.append(Target(splash, width, height, 18))

    # 通知栏小图标：系统只取 alpha 通道，必须是纯白剪影、背景透明
    targets.append(
        Target(ANDROID_RES / "drawable-nodpi/ic_stat_daymark.png", 96, 96, 74, "none", tint="#FFFFFF")
    )
    return targets


def render(targets: list[Target]) -> None:
    executable = chromium_executable()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=executable,
            args=["--no-sandbox", "--force-color-profile=srgb"],
        )
        page = browser.new_page(device_scale_factor=1)
        for target in targets:
            target.path.parent.mkdir(parents=True, exist_ok=True)
            page.set_viewport_size({"width": target.width, "height": target.height})
            # 透明底与圆形裁剪都必须 omit_background，否则四角会留着背景色
            transparent = target.bg == "none" or target.round
            page.set_content(
                TEMPLATE.format(
                    size=target.mark,
                    page_bg=BG["none"] if transparent else BG[target.bg],
                    stage_bg=BG[target.bg],
                    radius="50%" if target.round else "0",
                    fill=target.tint or "url(#g)",
                    dot=target.tint or "#B9AFFF",
                    o1="1" if target.tint else "0.5",
                    o2="1" if target.tint else "0.78",
                    o3="1",
                )
            )
            page.screenshot(path=str(target.path), omit_background=transparent)
            print(f"{str(target.path.relative_to(ROOT)):58} {target.width}x{target.height}")
        browser.close()


def chromium_executable() -> str | None:
    override = os.environ.get("DAYMARK_CHROMIUM")
    if override:
        return override
    for candidate in CHROMIUM_CANDIDATES:
        if pathlib.Path(candidate).exists():
            return candidate
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="生成 Daymark 图标与启动图")
    parser.add_argument("--web", action="store_true", help="只画 public/ 的 PWA 图标")
    parser.add_argument("--native", action="store_true", help="只画 iOS/Android 原生资源")
    parser.add_argument("--only", default="", help="只画指定文件名，逗号分隔")
    args = parser.parse_args()

    both = not (args.web or args.native)
    targets: list[Target] = []
    if args.web or both:
        targets += web_targets()
    if args.native or both:
        targets += native_targets()

    if args.only:
        wanted = {name.strip() for name in args.only.split(",") if name.strip()}
        targets = [target for target in targets if target.path.name in wanted]
        if not targets:
            print(f"没有匹配的文件名：{args.only}", file=sys.stderr)
            return 1

    OUT.mkdir(parents=True, exist_ok=True)
    render(targets)
    return 0


if __name__ == "__main__":
    sys.exit(main())
