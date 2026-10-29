# iPhone 安装与使用（0.2.0）

## 安装包状态

0.2.0 的最终 IPA 已于 2026-10-30 构建成功。源码分支为 `codex/ios-rounded-ui`，构建提交为 `7e4dd27`。

- 本地安装文件：`dist/releases/family-ledger-0.2.0.ipa`（13,878,095 字节）。
- [GitHub 构建与下载](https://github.com/Mistral-Isle/family-ledger/actions/runs/40932822196)：Artifacts 中下载 `family-ledger-unsigned`，解压取得 IPA；产物保留至 2026-11-06 02:55（北京时间）。
- SHA-256：`00f23fdfc64a36037b20804038eea586c5af760776127b2e4aaabeb85d7d7a74`。
- 已核对真机 arm64 架构、iOS 16.4 最低版本、0.2.0 / build 2、内置 Hermes 资源及最新“日期与时间”组件。

这是供 SideStore 重新签名的 IPA。单独运行 `export:ios` 只导出资源，不会生成 IPA。

本应用最低 iOS 版本以 IPA 内的 MinimumOSVersion 为准；当前 Expo 原生模块要求至少 iOS 16.4，Liquid Glass 需要 iOS 26+。

## 已经安装好 SideStore

1. 下载构建产物 ZIP，解压得到 `family-ledger-unsigned.ipa`，将 IPA 保存到 iPhone「文件」App。
2. 连接 Wi-Fi，打开 LocalDevVPN 并连接。安装、升级和刷新时都保持连接。
3. 打开 SideStore → My Apps（我的 App）→ 左上角「＋」，从「文件」选择该 IPA，等待签名与安装完成。
4. 如系统提示，按指引在「设置 → 通用 → VPN 与设备管理」信任自己的开发者账户；iOS 16 及以上还需开启「设置 → 隐私与安全性 → 开发者模式」。
5. 打开「两个人的账本」。本包无需 Metro、Expo Go 或电脑运行开发服务器。

SideStore 的免费账户通常有 7 天签名有效期，并且最多同时安装 3 个应用（含 SideStore）。到期前在 My Apps 刷新应用和 SideStore；以实际倒计时为准。依据：[SideStore FAQ](https://docs.sidestore.io/docs/faq)、[安装准备](https://docs.sidestore.io/docs/installation/prerequisites)。

## 尚未安装 SideStore

按照 [SideStore 官方安装流程](https://docs.sidestore.io/docs/installation/install) 操作：电脑安装 iloader，USB 连接并信任 iPhone，用自己的 Apple Account 安装 SideStore Stable，开启 LocalDevVPN，再在 SideStore 登录同一账户并先刷新 SideStore。账户密码只在你自己的安装器中输入。

## 这次更新怎么用

- 明细首页向下拉显示搜索框，可搜索备注、分类和账户；「筛选分类」支持一级、二级分类选择。
- 右下角「＋」记账。上方支出／收入／转账可切换；点击一级分类打开二级分类，也可直接选择整个一级。
- 记账页只有一个日期时间入口，今天默认显示当前时间。点击后上方显示系统日历，下方为“时间”开关和时间按钮；点击时间按钮展开原生滚轮。关闭“记录时间”只保存日期；取消不修改，确定一起保存。旧流水没有时间时保持为空。
- 「统计 → 分类占比」切换一级／二级环图。一级分类点击展开其明细；筛选分类可聚焦单个类别。
- 「统计 → 本月预算 → 编辑预算」填写总预算、一级预算，再展开填写二级预算。总预算 ≥ 一级之和；每个一级 ≥ 其二级之和。任何不满足条件的组合不能保存。留空为不单独分配，0 为零预算。
- 「我的 → 外观」切换系统白、暖白、深色。iOS 26+ 使用原生 Liquid Glass 材质和系统分段控件；旧系统或减少透明度开启时使用清晰的普通材质。网页截图用于展示排版，不能展示 iOS 的真实折射效果。
- 保留单笔左滑删除、右滑退款，去掉多选入口和“为我／为她／共同”控件。

## 升级保留数据

升级前在旧版本「我的 → 备份与恢复」导出完整备份。使用同一 Apple Account 和相同 Bundle ID 覆盖安装，不要先卸载旧应用。Bundle ID 为 `com.dwigh.familyledger`。数据库自动添加时间和分类预算字段，旧日期与金额不变。备份格式升级为 v4，支持读取 v1/v2/v3；两台同步设备都应升级到本版本，旧版本不能识别新增字段。

## 构建与验收

GitHub Actions 的 `Unsigned iOS build` 在本次分支推送或手动触发时运行：安装锁定依赖 → 类型与数据测试 → Expo prebuild → Xcode Release 真机 arm64 编译 → 打包 Payload → 上传 IPA。源码不包含 Apple Account 密码、签名证书或用户账本。

已完成：117 项自动化测试、Web/iOS 资源导出、375×667 与 390×844 网页交互验收。真机仍需核对玻璃效果、系统日期选择器、Face ID、相机配对、本地通知、SideStore 签名及覆盖安装；这些不能由网页截图代替。
