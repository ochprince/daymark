# App Store 上架清单

> 标 **[人工]** 的必须在 Apple Developer / App Store Connect / Xcode 里由人来点，
> 代码仓库这边做不了。其余是仓库内可完成项。

## 一、账号与主体

- [ ] **[人工]** Apple Developer Program 付费账号（个人 $99/年，公司需 D-U-N-S）
- [ ] **[人工]** 决定开发者主体：个人「XXX」还是量译（成都）科技有限公司
      —— 公司账号审核更慢，但 App 底下显示公司名，卖 $0.99 更可信
- [ ] **[人工]** App Store Connect 建 App，Bundle ID 填 `com.liangyi.daymark`

> 机器能验的部分已经脚本化：`python3 scripts/check-native.py`（21 项通过才是绿的）。
- [ ] **[人工]** 税务与银行信息（收款必需，中国区需填 W-8BEN）

## 二、元数据

- [ ] App 名称查重：**「Daymark」大概率已被占用**，备选：`Daymark · 刻度`、`刻度`、`One Day`
- [ ] 副标题（30 字符内）：中「一天只看一件事」/ 英 `One thing at a time`
- [ ] 关键词（100 字符，逗号分隔，不要空格浪费字符）
- [ ] 描述：中英两版，说清「不要连续打卡、断了不算失败」
- [x] 截图：6.7" 1290×2796，中英各 5 张，已由 `scripts/store-shots.py` 生成到 `docs/store/{zh,en}/`
      （重跑：`npm run build` → 起 5191 静态服务 → `python3 scripts/store-shots.py`）
- [ ] 截图：6.5" 1242×2688 一套（如果 App Store Connect 只收 6.7" 可跳过）
- [ ] 隐私政策 URL 与支持 URL（可放 GitHub Pages）
- [ ] 年龄分级：4+
- [ ] 分类：效率 / 生活（主类选效率）

## 三、审核要点

- [ ] **[人工]** App 内不能出现「安卓版」「官网下载」这类引流字样
- [ ] 数字功能必须走 IAP，**不能放外部支付链接**（已在 `src/lib/purchase.ts` 保证）
- [ ] 恢复购买入口真实可用（付费墙里有）
- [ ] 首次启动不需要登录（本应用无账号，天然满足）
- [ ] 空状态不能是白屏：首启有引导蛋与「记一件事」（已实现）

## 四、4.2「功能单薄」对冲

纯 WebView 壳容易被拒。我们已经具备的原生特性：

- [ ] 触感反馈（蓄力、进化）—— `haptics`
- [ ] 本地通知（提醒）
- [ ] 系统分享与保存图片
- [ ] 状态栏与安全区适配
- [ ] 离线可用（Service Worker + 全本地存储）

建议补充（提高过审率）：

- [ ] 桌面小组件（WidgetKit）显示「第 N 天」
- [ ] 快捷指令 / App Intents：一句话记一次
- [ ] iCloud 备份（或用「导出备份」+ 文件 App 替代）

## 五、隐私与合规

- [ ] App Privacy 问卷：**不收集任何数据**（无账号、无埋点、无第三方 SDK）
- [ ] 若接入广告（当前**未接入**，开关预留），必须改问卷并加 ATT 弹窗
- [ ] `PrivacyInfo.xcprivacy` 已声明无追踪、无数据收集（仓库内）
- [ ] 出口合规：`ITSAppUsesNonExemptEncryption = false`（已写在 Info.plist）
- [ ] 中国区上架需要 ICP 备案号（若只上国际区可跳过）

## 六、价格与 IAP

- [ ] **[人工]** App Store Connect 建**非消耗型** IAP：`com.liangyi.daymark.pro`
- [ ] **[人工]** 价格选最低档 $0.99（中国区约 ¥6）
- [ ] 免费版口径：2 件事、软糖皮肤、藏馆前 3 本（`src/lib/entitlement.ts`）
- [ ] 付费墙文案与价格展示：当前硬编码 `$0.99`，**上架前应改为读 StoreKit 本地化价格**
- [ ] 免费版没有广告；若后续加广告，需重新过审并更新隐私问卷

## 七、发布前自检

```bash
npx tsc -b && npm test && npm run build:native
npx cap sync ios
```

- [ ] 真机安装测试（iOS 16+ 至少两台不同尺寸）
- [ ] 深色 / 浅色两套皮肤都过一遍
- [ ] 中英文各截一次回归
- [ ] 断网启动不白屏
- [ ] 卸载重装后「恢复购买」能拿回付费状态
