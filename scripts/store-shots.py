#!/usr/bin/env python3
"""生成 App Store 截图（6.7 英寸 1290×2796）。

用法：
    python3 scripts/store-shots.py           # 中英各一套，存到 docs/store/
    python3 scripts/store-shots.py zh        # 只出中文

前置：
    npm run build
    python3 -m http.server 5191 --bind 127.0.0.1 --directory dist

说明：这里用真实构建 + 真机尺寸视口，不摆拍假界面——截图里的数字、文案都来自应用本身。
"""
from __future__ import annotations

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "store"
URL = "http://127.0.0.1:5191/"
# App Store Connect 要的两档尺寸（@3x）
SIZES = {
    "6.7": {"width": 430, "height": 932, "px": "1290x2796"},  # iPhone 16 Pro Max
    "6.5": {"width": 414, "height": 896, "px": "1242x2688"},  # iPhone 11 Pro Max
}
DPR = 3
CHROME = "/root/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome"

SEED = {
    "zh": """
(() => {
  const now = Date.now(), day = 86400000;
  const k = ts => { const d = new Date(ts); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') };
  const days = {}; const times = {};
  for (let i = 0; i < 40; i++) { if (i % 7 === 6) continue; const key = k(now - i*day); days[key] = 3 + (i % 3); times[key] = [now - i*day]; }
  localStorage.setItem('daymark.events.v1', JSON.stringify([
    {id:'e1', title:'戒烟', createdAt: now-400*day, startedAt: now-128*day, anchorAt: now-128*day, color:0, species:'sprout', remind:{kind:'daily', time:'21:00'}},
    {id:'e2', title:'学吉他', createdAt: now-300*day, startedAt: now-34*day, anchorAt: now-34*day, color:2, species:'pebble'}]));
  localStorage.setItem('daymark.checkins.v1', JSON.stringify([
    {id:'c1', title:'喝水', createdAt: now-200*day, color:3, cadence:'daily', species:'drop', target:8, days, times, growthDays:64},
    {id:'c2', title:'跑步', createdAt: now-120*day, color:4, cadence:'weekly', species:'wing', target:3, days:{}, times:{}, growthDays:21}]));
  localStorage.setItem('daymark.countdowns.v1', JSON.stringify([
    {id:'d1', title:'妈妈的生日', createdAt: now-60*day, startedAt: now+23*day, color:1, repeat:'yearly', remind:{kind:'before', daysBefore:3, time:'20:00'}},
    {id:'d2', title:'去京都', createdAt: now-40*day, startedAt: now+61*day, color:5, repeat:'none'}]));
  localStorage.setItem('daymark.collection.v1', JSON.stringify({
    badges:['first','week','month','dawn','note'],
    dex:{'sprout:0':1,'sprout:1':1,'sprout:2':1,'sprout:3':1,'drop:0':1,'drop:1':1,'pebble:0':1,'pebble:1':1,'pebble:2':1,'wing:0':1},
    seenStage:{'since:e1':4,'since:e2':3,'habit:c1':3,'habit:c2':2}, peakStage:{'since:e1':4,'since:e2':3,'habit:c1':3,'habit:c2':2}, notes:[{id:'n1', text:'第 30 天的时候，忽然就不想抽了。', at: now-9*day}]}));
  localStorage.setItem('daymark.focus.v1', JSON.stringify('since:e1'));
  localStorage.setItem('daymark.entitlement.v1', JSON.stringify({pro:true, purchasedAt: now}));
  localStorage.setItem('daymark.locale.v1', '"zh"');
  localStorage.setItem('daymark.skin.v1', JSON.stringify({pack:'jelly', accent:'auto', numStyle:'auto', texture:'auto', followSystem:false}));
})()
""",
    "en": """
(() => {
  const now = Date.now(), day = 86400000;
  const k = ts => { const d = new Date(ts); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') };
  const days = {}; const times = {};
  for (let i = 0; i < 40; i++) { if (i % 7 === 6) continue; const key = k(now - i*day); days[key] = 3 + (i % 3); times[key] = [now - i*day]; }
  localStorage.setItem('daymark.events.v1', JSON.stringify([
    {id:'e1', title:'Quit smoking', createdAt: now-400*day, startedAt: now-128*day, anchorAt: now-128*day, color:0, species:'sprout', remind:{kind:'daily', time:'21:00'}},
    {id:'e2', title:'Learn guitar', createdAt: now-300*day, startedAt: now-34*day, anchorAt: now-34*day, color:2, species:'pebble'}]));
  localStorage.setItem('daymark.checkins.v1', JSON.stringify([
    {id:'c1', title:'Water', createdAt: now-200*day, color:3, cadence:'daily', species:'drop', target:8, days, times, growthDays:64},
    {id:'c2', title:'Running', createdAt: now-120*day, color:4, cadence:'weekly', species:'wing', target:3, days:{}, times:{}, growthDays:21}]));
  localStorage.setItem('daymark.countdowns.v1', JSON.stringify([
    {id:'d1', title:"Mom's birthday", createdAt: now-60*day, startedAt: now+23*day, color:1, repeat:'yearly', remind:{kind:'before', daysBefore:3, time:'20:00'}},
    {id:'d2', title:'Kyoto', createdAt: now-40*day, startedAt: now+61*day, color:5, repeat:'none'}]));
  localStorage.setItem('daymark.collection.v1', JSON.stringify({
    badges:['first','week','month','dawn','note'],
    dex:{'sprout:0':1,'sprout:1':1,'sprout:2':1,'sprout:3':1,'drop:0':1,'drop:1':1,'pebble:0':1,'pebble:1':1,'pebble:2':1,'wing:0':1},
    seenStage:{'since:e1':4,'since:e2':3,'habit:c1':3,'habit:c2':2}, peakStage:{'since:e1':4,'since:e2':3,'habit:c1':3,'habit:c2':2}, notes:[{id:'n1', text:'Around day 30 the craving just left.', at: now-9*day}]}));
  localStorage.setItem('daymark.focus.v1', JSON.stringify('since:e1'));
  localStorage.setItem('daymark.entitlement.v1', JSON.stringify({pro:true, purchasedAt: now}));
  localStorage.setItem('daymark.locale.v1', '"en"');
  localStorage.setItem('daymark.skin.v1', JSON.stringify({pack:'jelly', accent:'auto', numStyle:'auto', texture:'auto', followSystem:false}));
})()
""",
}

LABELS = {
    "zh": {"profile": "档案 ›", "tabs": ["藏馆", "装扮"], "close": "关闭"},
    "en": {"profile": "Profile ›", "tabs": ["Museum", "Style"], "close": "Close"},
}


def shoot(locale: str, size: str = "6.7") -> list[Path]:
    seed = SEED[locale]
    labels = LABELS[locale]
    viewport = {"width": SIZES[size]["width"], "height": SIZES[size]["height"]}
    # 6.7" 放 docs/store/{locale}/（主用），6.5" 放 docs/store/6.5/{locale}/
    outdir = OUT / locale if size == "6.7" else OUT / size / locale
    outdir.mkdir(parents=True, exist_ok=True)
    shots: list[Path] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME)
        ctx = browser.new_context(viewport=viewport, device_scale_factor=DPR, locale="zh-CN" if locale == "zh" else "en-US")
        ctx.add_init_script(seed)
        page = ctx.new_page()
        page.goto(URL)
        page.wait_for_timeout(1200)
        # 播种的形态如果比 seenStage 新，会补播进化过场（还可能排队好几个）；
        # 这里一路点「看完」直到没有过场层，再开始截图
        for _ in range(12):
            if page.locator(".evolve").count() == 0:
                break
            page.wait_for_timeout(400)
            page.eval_on_selector_all(
                ".evolve button",
                "bs => { const b = bs[bs.length - 1]; if (b) b.click() }",
            )
            page.wait_for_timeout(500)
        page.wait_for_timeout(600)

        def snap(name: str) -> None:
            path = outdir / f"{name}.png"
            page.screenshot(path=str(path))
            shots.append(path)
            print(f"  {path.relative_to(ROOT)}")

        snap("01-today")

        # 切换面板（点的是舞台上那个胶囊，不是随便一个按钮）
        page.locator("button.pill-switch").first.click()
        page.wait_for_timeout(800)
        snap("02-switcher")
        page.locator(".sheet .icon-btn").first.click()
        page.wait_for_timeout(500)

        # 档案
        page.get_by_text(labels["profile"], exact=False).first.click()
        page.wait_for_timeout(1000)
        snap("03-profile")
        page.get_by_role("button", name=labels["close"]).first.click()
        page.wait_for_timeout(500)

        # 藏馆 / 装扮
        for index, name in enumerate(["04-museum", "05-dress"], start=0):
            page.get_by_text(labels["tabs"][index], exact=False).last.click()
            page.wait_for_timeout(900)
            snap(name)

        browser.close()
    return shots


def main() -> int:
    args = sys.argv[1:]
    sizes = [a for a in args if a in SIZES] or ["6.7"]
    wanted = [a for a in args if a in SEED] or ["zh", "en"]
    total = 0
    for size in sizes:
        for locale in wanted:
            print(f"{size}\" / {locale}:")
            total += len(shoot(locale, size))
    print(f"\n共 {total} 张 → {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
