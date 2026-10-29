# 两个人的账本

离线优先的双人家庭记账 App，使用 Expo / React Native / TypeScript、SQLite 和整数分金额。当前为开发预览，Bundle ID 固定为 `com.dwigh.familyledger`。

## 当前能力

- 家庭支出、收入、退款、账户间转账、分类管理、常用预设、多选删除。
- 周／月／年／全部／自定义统计、分类环图与环比、成员筛选与占比、预算、收支日历、五工作表 Excel 与 CSV。
- 分类迁移／丢弃、影响预览、批次恢复和已丢弃记录逐笔恢复，实际账户余额保持不变。
- 完整 JSON 备份／恢复；数据格式 v3，兼容 v1／v2，外层 SHA-256 完整性校验。文件包含私有数据且未加密。
- 小金库：设备身份验证、后台锁定、私有账户与流水、家庭互转金额外壳；网页预览保持锁定。
- 简易贷款、还款／结清／本金校准、押金退款与扣除、预付按月分摊、租房快捷设置、本地提醒。
- 加密 WebDAV 日志、前台自动同步与重试、成员配对二维码／恢复码、加密同步包。默认坚果云；实际凭据只在 App 中填写。

## 本地运行

```powershell
npm ci
npm run check
npm run web
```

网页预览：`http://127.0.0.1:4173`。`npm run web` 先导出再启动带 COOP/COEP 头的静态服务。SQLite 网页文件在浏览器中持久化；同源多标签采用独占等待，关闭正在使用的账本标签后，等待页会自动继续。

```powershell
npm start
npm run export:ios
```

`export:ios` 只生成 JavaScript/Hermes 和资源，不生成可安装 IPA。原生 Face ID、文件分享、相机、钥匙串和通知必须用 iPhone 验收。

## 同步与备份

“我的 → 家庭同步”配置 HTTPS WebDAV 地址、账号、应用密码。创建家庭后保存恢复码，另一台新账本通过二维码或粘贴配对信息加入。二维码含家庭密钥，不含 WebDAV 密码，只交给另一位家庭成员。

同步只包含家庭数据；本机偏好、私有账户和流水不上传。服务器保存 XChaCha20-Poly1305 密文文件，仍可看到文件名、数量、大小和请求时间。原生凭据保存在设备钥匙串，网页仅保存在当前会话，网页连接还要求服务端支持跨域。

完整备份用于单机恢复，包含设备身份，不能拿同一份备份复制出两台并行写入的设备。恢复会停止同步，重新连接前确认账本身份。恢复码与 WebDAV 凭据不在数据库备份内，须另外保管。

## 验证与安装

当前完整检查通过 113 项自动测试；Web 和 iOS 资源导出通过。浏览器实测备份往返、预算、导出、财务操作、配对校验与网页私有区锁定。详见 [验证记录](docs/verification.md)。

已准备手动触发的 [未签名 iOS 构建工作流](.github/workflows/ios-unsigned.yml)；尚未在 macOS/GitHub Actions 执行，也没有生成 IPA。仓库目前没有 GitHub remote。后续步骤见 [iOS 构建与真机验收](docs/ios-build-and-acceptance.md)。

## 维护入口

- [开发进度](docs/开发进度.md)：阶段状态及下一轮入口。
- [需求与剩余事项](docs/后续需求与待确认事项.md)：已确认决策、剩余功能和验收。
- [开发决策](docs/decisions.md)：实现取舍。
- `src/db/repository.ts`：事务、写入、outbox、合并；页面不得直接写数据库。
- `src/domain`：金额、统计、财务计划、同步协议；`tests` 使用真实 Node SQLite。

`deleted` 流水退出余额；`discarded` 流水仅退出明细和统计，仍影响实际余额。已有数据库迁移不可覆盖；新增 schema 必须添加迁移，并同步检查备份格式。

`expo-sqlite@57.0.4` 网页同步桥长度截断问题由 `scripts/fix-sqlite-web.cjs` 在 postinstall 可复现修复；升级 Expo 时需要重新审查。该补丁不修改原生 SQLite。
