#!/usr/bin/env python3
"""上架前自检：原生壳与构建产物是否齐活。

只做「机器能判断的」那一半——签名、账号、App Store Connect 里的事都做不了。
用法：
    python3 scripts/check-native.py

有 FAIL 时退出码非 0。
"""
from __future__ import annotations

import json
import re
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PASSED: list[str] = []
WARNED: list[str] = []
FAILED: list[str] = []


def ok(name: str, detail: str = "") -> None:
    PASSED.append(f"{name}{(' — ' + detail) if detail else ''}")


def warn(name: str, detail: str = "") -> None:
    WARNED.append(f"{name}{(' — ' + detail) if detail else ''}")


def fail(name: str, detail: str = "") -> None:
    FAILED.append(f"{name}{(' — ' + detail) if detail else ''}")


def png_size(path: Path) -> tuple[int, int] | None:
    """不依赖 PIL 读 PNG 尺寸（IHDR 前 24 字节）"""
    try:
        with path.open("rb") as handle:
            head = handle.read(24)
    except OSError:
        return None
    if len(head) < 24 or head[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    width, height = struct.unpack(">II", head[16:24])
    return width, height


# --- 1. Capacitor 配置 -------------------------------------------------------

def check_capacitor() -> None:
    config = ROOT / "capacitor.config.ts"
    if not config.exists():
        fail("capacitor.config.ts 存在")
        return
    text = config.read_text(encoding="utf-8")
    ok("capacitor.config.ts 存在")

    app_id = re.search(r"appId:\s*['\"]([^'\"]+)['\"]", text)
    if not app_id:
        fail("capacitor.config.ts 里能读到 appId")
    elif app_id.group(1).count(".") < 2:
        fail("appId 形态合法", f"现在是 {app_id.group(1)}，应该是反向域名")
    else:
        ok("appId 形态合法", app_id.group(1))

    web_dir = re.search(r"webDir:\s*['\"]([^'\"]+)['\"]", text)
    if not web_dir:
        fail("capacitor.config.ts 里能读到 webDir")
    elif not (ROOT / web_dir.group(1)).exists():
        fail("webDir 指向的目录已构建", f"{web_dir.group(1)} 不存在，先 npm run build:native")
    else:
        ok("webDir 指向的目录已构建", web_dir.group(1))


# --- 2. Info.plist ----------------------------------------------------------

def check_info_plist() -> None:
    plist = ROOT / "ios" / "App" / "App" / "Info.plist"
    if not plist.exists():
        fail("Info.plist 存在")
        return
    text = plist.read_text(encoding="utf-8")
    ok("Info.plist 存在")

    export_key = re.search(
        r"<key>ITSAppUsesNonExemptEncryption</key>\s*<(true|false)\s*/>", text
    )
    if not export_key:
        fail("出口合规键 ITSAppUsesNonExemptEncryption 已声明")
    elif export_key.group(1) == "true":
        warn("出口合规键为 true", "用了自研加密才该是 true，纯 HTTPS 应该是 false")
    else:
        ok("出口合规键为 false")

    if "UILaunchStoryboardName" in text or "UILaunchScreen" in text:
        ok("有启动屏配置")
    else:
        fail("有启动屏配置", "没有 LaunchScreen 会被审核当成未适配新机型")


# --- 3. 隐私清单 ------------------------------------------------------------

def check_privacy_manifest() -> None:
    path = ROOT / "ios" / "App" / "App" / "PrivacyInfo.xcprivacy"
    if not path.exists():
        fail("PrivacyInfo.xcprivacy 存在")
        return
    text = path.read_text(encoding="utf-8")
    ok("PrivacyInfo.xcprivacy 存在")

    tracking = re.search(r"<key>NSPrivacyTracking</key>\s*<(true|false)\s*/>", text)
    if tracking and tracking.group(1) == "false":
        ok("隐私清单声明不做追踪")
    else:
        fail("隐私清单声明 NSPrivacyTracking=false")

    # 空数组可能写成 <array/>，也可能写成 <array>\n</array>
    collected = re.search(
        r"<key>NSPrivacyCollectedDataTypes</key>\s*(?:<array\s*/>|<array>(.*?)</array>)", text, re.S
    )
    if collected is None:
        fail("隐私清单里有 NSPrivacyCollectedDataTypes 段")
    elif (collected.group(1) or "").strip() == "":
        ok("声明不收集任何数据类型")
    else:
        warn("声明了收集数据类型", "和「零收集」的说法冲突，检查问卷是否要同步改")


# --- 4. 图标与启动图 --------------------------------------------------------

def check_ios_assets() -> None:
    icon_dir = ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "AppIcon.appiconset"
    if not icon_dir.exists():
        fail("AppIcon.appiconset 存在")
        return
    ok("AppIcon.appiconset 存在")

    big = None
    for png in sorted(icon_dir.glob("*.png")):
        size = png_size(png)
        if size and size[0] >= 1024:
            big = (png, size)
            break
    if big is None:
        fail("有 1024×1024 的商店图标", "App Store 强制要求")
    else:
        ok("有 1024×1024 的商店图标", f"{big[0].name} {big[1][0]}×{big[1][1]}")

    splash_dir = ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "Splash.imageset"
    if splash_dir.exists() and list(splash_dir.glob("*.png")):
        ok("启动图存在")
    else:
        warn("启动图缺失", "会显示白屏")


# --- 5. Web 构建产物 --------------------------------------------------------

def check_web_build() -> None:
    index = ROOT / "dist" / "index.html"
    if not index.exists():
        fail("dist/index.html 存在", "先跑 npm run build:native")
        return
    ok("dist/index.html 存在")
    html = index.read_text(encoding="utf-8")
    if re.search(r'src="[^"]*\.js"', html):
        ok("dist/index.html 引用了打包后的脚本")
    else:
        fail("dist/index.html 引用了打包后的脚本")


# --- 6. 依赖与脚本 ----------------------------------------------------------

def check_package_json() -> None:
    path = ROOT / "package.json"
    if not path.exists():
        fail("package.json 存在")
        return
    pkg = json.loads(path.read_text(encoding="utf-8"))
    deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
    scripts = pkg.get("scripts", {})

    if "@capacitor/core" in deps:
        ok("依赖里有 @capacitor/core", deps["@capacitor/core"])
    else:
        fail("依赖里有 @capacitor/core")

    if "build:native" in scripts:
        ok("脚本里有 build:native")
    else:
        fail("脚本里有 build:native")

    # 代码里点名的插件，依赖里最好也有；只在原生侧才用到的不强求
    native_ts = ROOT / "src" / "lib" / "native.ts"
    if native_ts.exists():
        used = set(re.findall(r"invoke\('(\w+)'", native_ts.read_text(encoding="utf-8")))
        package_of = {
            "Haptics": "@capacitor/haptics",
            "Share": "@capacitor/share",
            "LocalNotifications": "@capacitor/local-notifications",
            "StatusBar": "@capacitor/status-bar",
            "SplashScreen": "@capacitor/splash-screen",
        }
        missing = [
            package_of[name]
            for name in sorted(used)
            if name in package_of and package_of[name] not in deps
        ]
        if missing:
            warn("有一部分原生插件还没装", "、".join(missing) + "（npx cap sync 之前要装上）")
        elif used:
            ok("原生插件依赖齐全", "、".join(sorted(used)))


# --- 7. 商店素材 ------------------------------------------------------------

def check_store_assets() -> None:
    for size, expect in (("6.7", (1290, 2796)), ("6.5", (1242, 2688))):
        base = ROOT / "docs" / "store" if size == "6.7" else ROOT / "docs" / "store" / size
        for locale in ("zh", "en"):
            shots = sorted((base / locale).glob("*.png"))
            if not shots:
                fail(f"{size}\" {locale} 截图", "跑 scripts/store-shots.py")
                continue
            bad = [p.name for p in shots if png_size(p) != expect]
            if bad:
                fail(f"{size}\" {locale} 截图尺寸", f"{'、'.join(bad[:3])} 不是 {expect[0]}×{expect[1]}")
            else:
                ok(f"{size}\" {locale} 截图", f"{len(shots)} 张 {expect[0]}×{expect[1]}")

    listing = ROOT / "docs" / "store" / "LISTING.md"
    ok("商店文案清单存在" if listing.exists() else "商店文案清单缺失")
    if not listing.exists():
        fail("商店文案清单存在")


def main() -> int:
    for check in (
        check_capacitor,
        check_info_plist,
        check_privacy_manifest,
        check_ios_assets,
        check_web_build,
        check_package_json,
        check_store_assets,
    ):
        try:
            check()
        except Exception as error:  # noqa: BLE001 - 自检脚本不该因为单项异常炸掉
            fail(check.__name__, f"检查自身出错：{error}")

    print(f"\n✓ 通过 {len(PASSED)}")
    for line in PASSED:
        print(f"  ✓ {line}")
    if WARNED:
        print(f"\n! 注意 {len(WARNED)}")
        for line in WARNED:
            print(f"  ! {line}")
    if FAILED:
        print(f"\n✗ 失败 {len(FAILED)}")
        for line in FAILED:
            print(f"  ✗ {line}")
        return 1
    print("\n可以进 Xcode 了。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
