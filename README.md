# 两个人的账本

面向 iPhone 的双人家庭记账 App。当前为 **v0.1 单机开发预览**，基于 Expo SDK 57、React Native、TypeScript strict、expo-router、SQLite 与 Drizzle 迁移。

## 启动

需要 Node.js 24 LTS 与 npm。在 PowerShell 中：

```powershell
cd D:\记账APP
npm ci
npm start
```

iPhone 与电脑连接同一 Wi-Fi，用支持 SDK 57 的 Expo Go 扫终端二维码。首次原生启动仍需在你的 iPhone 上实测；Windows 环境无法替代 iOS 真机验收。

```powershell
npm run web          # 构建并打开本机网页预览，地址 http://localhost:4173
npm run check        # TypeScript + Jest / 真实 SQLite
npm run export:ios   # 导出 iOS JavaScript/Hermes 资源（不是 IPA）
node scripts/expo.cjs install --check
```

`npm run web` 启动后手动打开终端显示的地址。它是构建后的预览，修改代码后需重启该命令。网页与手机的数据各自独立；网页测试记录以“开发验收”标记。正式使用前需完成备份/恢复。

## 已完成功能

### 阶段 0 · 工程基础

- 四个 Tab：明细、统计、资产、我的；中间按钮打开记账页。
- 跟随系统的浅色／深色主题，支持手动切换。
- iOS 使用 SF Symbols；网页使用 SVG 兼容图标。
- SQLite 数据库、Drizzle 版本迁移；金额统一为安全整数分。
- UUID、持久化 HLC 与设备序列；家庭写操作在同一事务内写 outbox。

### 阶段 1 · 单机记账核心

- 初始化本机成员“我”、零余额账户和默认两级分类，不预填真实流水。
- 支出、收入、转账；金额加减连算；日期、备注与“为谁”；连续记账。
- 最多四个常用账户、完整账户列表、分类上次使用账户、本机置顶偏好。
- 标准分类展开与日常常用项预设；常用项保存、移除与顺序调整。
- 按天分组流水、日合计、备注／分类／账户搜索；点按编辑、右滑退款、左滑删除、长按多选批量删除（新手势待实际预览／真机验收）。
- 关联原支出的分次退款、到账账户与日期、退款修改及累计限额；跨月退款按退款日抵减支出。
- 账户新增／编辑、期初余额、卡号末四位、置顶与归档；根据流水计算资产和负债。
- 分类新增／改名、颜色、图标、二级移动、隐藏及上移／下移排序。
- 月度收支概览与分类环形图，支持翻月查看。
- 私有范围写入和统计隔离的底层校验测试；本版尚未开放小金库入口。

排序当前使用上移／下移按钮，拖动手势尚未实现。当前流水时间精度为日期；小时／分钟选择后续补充。

## 后续阶段

持续更新的任务清单与待确认项见 [后续需求与待确认事项](docs/后续需求与待确认事项.md)。

1. 阶段 2：分类删除三种处理、影响预览与恢复，余额不变测试；完整备份/恢复；预算、日历、范围统计、CSV 与 Excel 导出。
2. 阶段 3：小金库解锁、私有记账与跨界转账；完善防泄漏测试。
3. 阶段 4：贷款、押金、预付分摊及本地提醒，先实现计算测试再做界面。
4. 阶段 5：加密 WebDAV 日志、双设备合并、扫码配对与恢复码。
5. 阶段 6：GitHub Actions 生成未签名 IPA，SideStore 与两台真机验收。

当前 **不会上传数据**，待同步操作只保存在本机；没有配对、恢复码、云端备份或正式安装包。

## 代码结构

| 位置                   | 职责                                |
| ---------------------- | ----------------------------------- |
| `src/app`              | 页面与路由                          |
| `src/db/schema.ts`     | Drizzle 表结构                      |
| `src/db/migration.ts`  | 已版本化的初始化迁移                |
| `src/db/repository.ts` | 统一写入入口、事务、校验、outbox    |
| `src/domain`           | 金额、日期、余额和统计纯函数        |
| `src/i18n/zh.ts`       | 中文文案与默认分类                  |
| `src/state`            | 临时界面状态                        |
| `tests`                | Node 内置 SQLite 上的领域与事务测试 |
| `docs/decisions.md`    | 默认值与实现取舍                    |
| `docs/verification.md` | 本轮验证记录和限制                  |

不要直接从页面写数据库。实体记录保留 UUID、时间戳、HLC 和墓碑；不存可被流水推导的账户余额。`deleted` 流水不参与余额；`discarded` 流水仍参与余额，仅排除明细和统计。

`db:generate` 用于生成下一次迁移草稿。当前运行时迁移内嵌在 TypeScript 中，避免原生打包依赖 SQL 文本导入插件；修改 schema 后必须审查并添加新的版本迁移，不要覆盖已发布迁移。

## 网页兼容补丁

`expo-sqlite@57.0.4` 的 Web 同步桥存在长度超过 255 字节时截断的问题，已用 `scripts/fix-sqlite-web.cjs` 在 `postinstall` 可复现修复。该补丁不改变 Expo Go 原生 SQLite；升级依赖时须复查。网页服务器提供 SQLite 需要的 COOP/COEP 响应头，数据库先异步初始化。

Bundle ID 固定为 `com.dwigh.familyledger`。不要在后续升级中修改。
