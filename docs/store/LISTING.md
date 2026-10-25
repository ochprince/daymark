# App Store 文案（待确认版）

> 直接照抄进 App Store Connect。长度都是按 Apple 的字符上限卡过的，
> 改文案后请重新数一遍（`python3 - <<'EOF'` 里 `len()` 即可，中文按 1 个字符算）。

---

## 名称（30 字以内）

| 顺序 | 名称 | 说明 |
| --- | --- | --- |
| 首选 | `Daymark · 刻度` | 中英都在，国际化友好 |
| 备选 1 | `刻度` | 如果 Daymark 已被占用 |
| 备选 2 | `One Day at a Time` | 太通用，可能也被占 |

> 上架前必须在 App Store Connect 里实际搜一遍，名称被占时用备选。

## 副标题（30 字符以内）

- 中文：`一天只看一件事`
- 英文：`One thing at a time`

## 关键词（100 字符以内，逗号分隔，不要重复名称里的词）

- 中文：`坚持,习惯,打卡,倒数日,纪念日,成长,提醒,自律,宠物,收集,戒瘾,日记,目标,记录,日历,治愈`（44 字符）
- 英文：`habit,tracker,streak,countdown,reminder,self care,journal,growth,pet,collection`（79 字符）

> Apple 会把名称/副标题里的词也算进检索，「daymark」「刻度」不用重复写。

## 描述（中文）

```
一次只看一件事。

Daymark 把「坚持」「习惯」「等待」三件事收在同一个地方，
让每一件你在意的事都有一只小伙伴陪着长大。

—— 不惩罚中断 ——
这里没有连续打卡，也没有「断了就清零」。
天数按累计算，30 天里记了 20 天，你就已经走了 20 天。
小伙伴不会因为你的停顿而离开，它只是睡着了，回来叫醒它就行。

—— 会长大的小伙伴 ——
累计 0 / 3 / 7 / 30 / 100 天，它会依次解锁五个形态。
形态只往上长，永不倒退；解锁过的都会进图鉴，不会被收回。

—— 藏馆 ——
每一段结束的坚持都会变成书架上的一本书，书脊高度就是那段日子有多长。
还有 12 枚徽章、散落在各处的纸条，和一只在图鉴里等你的特别篇。

—— 四套风格 ——
软糖、纸片、夜航、像素，四种气质，随时换。
主色、数字字体、纹理也都能调。

—— 数据在你手里 ——
没有账号，没有服务器，没有埋点。
所有内容只存在你的设备上，可以随时导出成一份 JSON 备份，
换机时导回去就行。

—— 关于完整版 ——
免费版可以同时记 2 件事，使用经典的软糖风格，翻阅最近的 3 个章节。
完整版一次买断（$0.99），解锁不限件数、全部四套风格、整座藏馆和分享卡片。
买断是永久的，不订阅，不按年续费。

—— 关于提醒 ——
提醒在 App 打开时生效；如果你要系统闹钟，可以把任意一件事导出到日历。
我们不做服务器推送——那需要账号，而这里没有账号。
```

## 描述（English）

```
One thing at a time.

Daymark keeps your streaks, habits and countdowns in one quiet place —
each one paired with a little companion that grows as you go.

— No punishment for stopping —
There is no streak to break. Days are counted in total, not in a row.
If you showed up 20 days out of 30, you have 20 days. That is the number.
Your companion never leaves when you pause; it just falls asleep.
Come back and wake it up.

— Companions that grow —
At 0 / 3 / 7 / 30 and 100 days it unlocks a new form.
Forms never go backwards, and everything you unlock stays in your collection.

— The museum —
Every finished chapter becomes a book on the shelf, and the height of its
spine is how long that stretch lasted. Plus 12 badges, little notes left
behind, and one special entry waiting in the collection.

— Four styles —
Jelly, Paper, Night and Pixel. Swap anytime, along with accent colour,
number style and texture.

— Your data stays yours —
No account, no server, no analytics. Everything lives on your device and
can be exported as a single JSON file whenever you like.

— Full version —
Free lets you keep 2 things at a time, use the Jelly style, and browse your
three most recent chapters. The full version is a one-time $0.99 purchase:
unlimited items, all four styles, the whole museum and share cards.
No subscription.

— About reminders —
Reminders fire while the app is open. For a real alarm, export any item to
your calendar. There are no server push notifications, because that would
require an account — and there isn't one.
```

## 推广文本（170 字符以内，可随时改，不需要重新审核）

- 中文：`新：四套风格、藏馆书架与分享卡片。一次买断，不订阅。`
- 英文：`New: four styles, the museum shelf, and share cards. One-time purchase, no subscription.`

## 分类与分级

| 项 | 值 |
| --- | --- |
| 主分类 | 效率（Productivity） |
| 次分类 | 生活（Lifestyle） |
| 年龄分级 | 4+（无用户生成内容、无广告、无外部链接） |
| 价格 | $0.99（Tier 1，中国区约 ¥6） |
| 内购 | 非消耗型：`com.liangyi.daymark.pro` |

## App 隐私问卷（逐项答案）

| 问题 | 答案 |
| --- | --- |
| 是否收集数据？ | 否 |
| 是否使用第三方 SDK？ | 否 |
| 是否用于追踪？ | 否 |
| 是否要求登录？ | 否 |
| 加密出口合规（ITSAppUsesNonExemptEncryption） | 否（只用系统 HTTPS，属豁免） |

## 审核备注（App Review Information，附给审核员）

```
Daymark 是一款本地优先的倒数日 / 习惯应用，不需要登录。

- 数据全部保存在设备本地（WKWebView localStorage），不上传任何服务器。
- 完整版通过 App Store 内购解锁（非消耗型，$0.99），付费墙里有「恢复购买」。
- 提醒为设备本地通知，权限只在用户主动开启提醒时请求。
- 免费版限制：2 件事、1 套风格、藏馆最近 3 个章节；所有已写内容始终可读、可导出。

测试路径：
1. 首次启动 → 首页「记一件事」→ 输入任意名称 → 开始记录
2. 右下「装扮」→「导入备份 / 导出备份」
3. 档案页 →「提醒」→ 选择每天 / 每周
4. 免费版建满 2 件事后再点「+」可以看到付费墙
```

## 截图

- 6.7"（1290×2796）：`docs/store/zh/`、`docs/store/en/`
- 6.5"（1242×2688）：`docs/store/6.5/zh/`、`docs/store/6.5/en/`
- 重新生成：见 `scripts/store-shots.py` 顶部注释

顺序建议：今天页 → 切换面板 → 档案 → 藏馆 → 装扮
