# iPhone 安装与使用（0.3.0）

## 安装包状态

**0.3.0 / build 3 已于 2026-10-31 构建并下载校验成功。** Bundle ID 保持 `com.dwigh.familyledger`。

构建后预览又修正了演示分类、预付/押金余额文案并补充偏好保存错误日志；这些后续改动尚未重新打包进下列 IPA。正式新账本的默认分类已包含在本 IPA 内；已有账本需通过分类管理的整理预览迁移历史分类。

- 本地文件：`dist/releases/family-ledger-0.3.0-sidestore.ipa`，13,988,426 字节（约 14 MB）。
- [GitHub 构建与下载](https://github.com/Mistral-Isle/family-ledger/actions/runs/41210487982)：下载 Artifacts 中的 `family-ledger-unsigned` 并解压；本次产物保留至 2026-11-07 22:47（北京时间）。
- 构建源码：`230cffe62826236bd6e4e953cb6b1b65582b9a14`；本地及 macOS 均通过 TypeScript、33 个套件共 201 项自动测试。
- IPA SHA-256：`a85d9fdd0bad488cad1b85c1c515a927ee514d89a361bf783a82f089caf1289e`。
- 已核验 GitHub 产物摘要、ZIP 完整性、Payload、Bundle ID、版本号、iPhoneOS arm64 可执行文件、iOS 16.4 最低版本、执行权限及无加密状态。
- 已核验内置 Hermes 字节码 5,248,227 字节和 `LedgerCategoryOrder` 原生组件。此检查不等同于 SideStore 签名或 iPhone 真机运行验收。

构建分支为 `codex/sidestore-0-3-0`。工作流使用 Release 真机配置，不签入开发证书；产物供 SideStore 使用用户自己的 Apple Account 重新签名。仅运行 `export:ios` 不会生成可安装 IPA。

## 使用 SideStore 更新

1. 将新版 IPA 保存到 iPhone「文件」App。若从 GitHub Actions 下载 Artifacts，先解压 ZIP 取得其中的 `family-ledger-unsigned.ipa`。
2. 按现有 SideStore 配置连接签名所需的 VPN，打开 SideStore → My Apps →「＋」，选择 IPA 完成签名与安装。
3. 打开「两个人的账本」，在「我的」核对版本 0.3.0。本包内置运行资源，无需 Expo Go、Metro 或电脑开发服务器。

升级前在旧版「我的 → 备份与恢复」导出完整备份。使用原 Apple Account 和相同 Bundle ID 覆盖安装，不要先卸载旧应用。数据库会自动追加迁移 0005/0006；备份数据格式为 v6，支持读取 v1–v5。参与同步的两台设备都应升级，以识别新增行程、付款人和排除统计字段。

SideStore 的签名有效期和刷新状态以其 My Apps 显示为准。官方参考：[SideStore FAQ](https://docs.sidestore.io/docs/faq)。

## 这次更新

- 明细首页收支／预算左右滑动，标题浮层切换主数字；记住两页主指标和当前页面。辅助数据跟随主指标变化，点击金额可进入统计或预算。
- 修复明细列表额外行间空白，同样行数的记录保持一致高度；长备注和系统大字体仍可自然撑开。
- 分类支持自定义顺序，iOS 使用原生列表拖动；默认分类整理需要用户预览确认，不自动覆盖旧账本。
- 行程、付款人、家庭代记、相似消费核对和导出；单笔可独立设置不计预算／不计收支，实际账户余额保持真实。
- 完善租房与预付分摊、押金承接、隐私互转、图表配色、报表选择、重复提交保护、备份恢复和账本状态刷新。
- 移除提醒设置，启动时仅清理旧通知；不再申请通知权限或新增提醒。

## 构建与验收

GitHub Actions 的 `Unsigned iOS build` 在 `codex/sidestore-*` 分支推送或手动触发时运行：锁定依赖安装 → 类型与数据测试 → Expo prebuild → Xcode Release 真机 arm64 编译 → 打包 Payload → 上传 IPA。

网页已核验 320/375/390px、深色、减少动态效果、鼠标与触屏切页、浮层、预算边界和明细间距。SideStore 签名与覆盖安装、原生分类拖动、VoiceOver、系统大字体、日期选择器、Face ID、相机配对、真实双机同步仍需用户 iPhone 验收。

补查 `scripts/smoke-entry-settings.cjs tmp/budget-demo-web` 通过：直接进入记账页的关闭／保存／删除、页面返回、使用后分类顺序、行程与更多设置保存、时间取消／确认、390×844 与 375×667 布局。

交互预览可运行 `node scripts/preview.cjs --demo`，访问 `http://127.0.0.1:4175`。示例模式使用独立数据库；正式 IPA 不包含该网页示例标记或示例账单。
