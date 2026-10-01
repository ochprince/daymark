#!/usr/bin/env python3
"""
生成 src/lib/lunar-dates.ts：农历节日 → 公历月日的离线表。

为什么不用浏览器的 ICU（Intl 的 Chinese 日历）：
ICU 用的是简化天文模型，个别年份会与官方历法差一天——例如 2027 年春节
ICU 给 02-07，而官方历法是 02-06。所以这里改用 lunardate（1900–2099 的
通用农历表），生成后由 tests 兜底校验。

依赖：pip install lunardate
用法：python3 scripts/gen-lunar-dates.py
"""
import pathlib
import sys

from lunardate import LunarDate

# 覆盖范围：农历 2024–2098。腊八/小年在农历十二月，落在下一个公历年，
# 查表时会用「公历年 - 1」，所以两头各多留一年。
START_LUNAR = 2024
END_LUNAR = 2098

# key → (农历月, 农历日)：与 src/lib/festivals.ts 的 lunar key 对应
FESTIVALS = {
    'chunjie': (1, 1),
    'yuanxiao': (1, 15),
    'longtaitou': (2, 2),
    'duanwu': (5, 5),
    'qixi': (7, 7),
    'zhongyuan': (7, 15),
    'zhongqiu': (8, 15),
    'chongyang': (9, 9),
    'laba': (12, 8),
    'xiaonian': (12, 23),
}

rows: dict[int, dict[str, str]] = {}
for lunar_year in range(START_LUNAR, END_LUNAR + 1):
    row: dict[str, str] = {}
    for key, (month, day) in FESTIVALS.items():
        solar = LunarDate(lunar_year, month, day).to_solar_date()
        row[key] = f'{solar.month:02d}-{solar.day:02d}'
    rows[lunar_year] = row

# 抽查几个官方日期，对不上就直接失败
CHECKS = {
    (2026, 'chunjie'): '02-17',
    (2027, 'chunjie'): '02-06',
    (2028, 'chunjie'): '01-26',
    (2026, 'zhongqiu'): '09-25',
    (2027, 'zhongqiu'): '09-15',
}
for (year, key), want in CHECKS.items():
    got = rows[year][key]
    if got != want:
        sys.exit(f'校验失败：{year} {key} 期望 {want}，实际 {got}')
print(f'已校验 {len(CHECKS)} 个官方日期')

lines = [
    '/**',
    ' * 农历节日对应的公历日期（MM-DD），按农历年索引。',
    ' *',
    ' * 由 scripts/gen-lunar-dates.py 用 lunardate 生成（1900–2099 的通用农历表），',
    f' * 覆盖农历 {START_LUNAR}–{END_LUNAR} 年；超出范围的年份会退回用 Intl 现场计算。',
    ' * 腊八、小年在农历十二月，落在下一个公历年，查表时会用「公历年 - 1」，',
    ' * 所以这里的月日是该月日所在公历年的月日（公历年按 key 推导）。',
    ' * 除夕 = 下一年正月初一的前一天，由 chunjie 推导，不单独存。',
    ' */',
    'export const LUNAR_FESTIVAL_DATES: Record<number, Record<string, string>> = {',
]
for lunar_year, row in rows.items():
    body = ', '.join(f"{key}: '{row[key]}'" for key in sorted(row))
    lines.append(f'  {lunar_year}: {{ {body} }},')
lines.append('}')
lines.append('')

target = pathlib.Path(__file__).resolve().parent.parent / 'src/lib/lunar-dates.ts'
target.write_text('\n'.join(lines))
print(f'已写入 {target}（{len(rows)} 行，{target.stat().st_size} 字节）')
