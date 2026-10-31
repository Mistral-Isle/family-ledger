# 明细页双页汇总卡片

2026-10-31：按已确认的交互预览接入 Expo / React Native APP。

## 行为

- 收支与预算在同一张紧凑卡片内左右滑动，也可点右上角文字切换。两页共用基础高度，金额和辅助数据允许随屏幕宽度、系统字号换行。
- 收支主数字在支出、收入、结余之间切换；其他两个指标留在辅助行。金额点击仍进入对应统计。
- 预算主数字在预算剩余、预算总额之间切换。继续使用明细预算的名称和分类排除范围；不影响完整预算和账单。
- 标题打开同主题的自定义浮层，当前项有勾选，可点外部或按 Escape 关闭。APP 使用 React Native Modal / Pressable；Web 不使用原生 select。
- 预算设置继续进入原有完整预算页面。保留日均说明、预算范围说明、未设置、零预算、超支、历史月份已结束状态。超支日均保留原有负数含义。
- 页面与两类主数字作为本机偏好保存；不写入家庭同步 outbox，不改变交易或余额。旧备份缺失偏好时回退到收支 / 支出 / 预算剩余；完整备份可往返保存选择。
- iOS 使用原生 ScrollView 分页；Web 使用方向判定的指针拖动，允许外层账单纵向滚动。主指标浮层立即开关，避免关闭动画阻挡紧接着的滑动；尊重减少动态效果。
- 明细列表覆盖通用 Card 的默认 gap，行间只保留分隔线；相同行数的记录保持同高，长备注仍可自动增高。

## 验证

- `npm run check`：33 个测试套件、201 项测试通过。
- `tests/summaryPreferences.test.ts`：重开与备份恢复、旧值回退、账本与 outbox 不变。
- `scripts/smoke-summary-card.cjs`：独立浏览器及一次性 SQLite 账本，覆盖真实收支和退款、鼠标与触屏切页、触屏选项、偏好恢复、统计跳转、预算编辑、分类排除和自定义名称、零/未设置/超支/历史预算、320/375/390px、深色与减少动态效果。
- Web 导出：`tmp/summary-web`；iOS Hermes / 资源导出：`tmp/summary-ios`。IPA 状态见 [安装说明](../ios-build-and-acceptance.md)，原生手势、VoiceOver 和系统大字体仍需 iPhone 真机验收。
- 390px 明细列表三条双行记录实测均为 65.05px，记录之间只有 1px 分隔线；不再叠加 14px 行间空白。

## 截图（测试账本）

- [收支卡片](summary-cashflow-390.png)
- [指标浮层](summary-metric-menu.png)
- [320px 预算卡片](summary-budget-320.png)
- [深色](summary-dark.png)
- [未设置预算](summary-unset.png)
- [预算超支](summary-overspent.png)
- [统一明细行间距](summary-transaction-spacing.png)

## 重现

```powershell
node scripts/expo.cjs export --platform web --output-dir tmp/summary-web --max-workers 2
# 若 Playwright 不在项目依赖中，将 PLAYWRIGHT_MODULE 指向本机安装路径。
node scripts/smoke-summary-card.cjs
node scripts/expo.cjs export --platform ios --output-dir tmp/summary-ios --max-workers 2
```

验收脚本自行启动临时端口并在结束时关闭，导入只发生在隔离浏览器中。
