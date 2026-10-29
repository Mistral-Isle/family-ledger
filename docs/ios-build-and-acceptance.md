# iOS 构建与真机验收

更新日期：2026-10-30。已准备 `.github/workflows/ios-unsigned.yml`，尚未执行 macOS 编译，也未生成 IPA。

## 构建

1. 将仓库推送到用户指定的 GitHub 仓库。当前本地没有 remote，未擅自创建远程仓库或上传代码。
2. 在 Actions 手动运行 **Unsigned iOS build**。工作流只申请 contents:read，安装锁定依赖，执行 TypeScript／测试，生成 iOS 工程，以 Release、iphoneos、禁用代码签名编译。
3. 下载 `family-ledger-unsigned` 构建产物。IPA 只是待侧载签名的包；使用自己的 SideStore 或其他已选侧载流程签名安装。
4. 若 Xcode 或 Pods 失败，保留 Actions 日志，按实际错误修复。Windows 的 Hermes 导出不能证明 Xcode 编译成功。`macos-latest` 的 Xcode 能力也必须以真正执行结果为准。

Bundle ID 保持 `com.dwigh.familyledger`，以便同身份升级；不要随意改名。未添加远程推送、App Groups 或扩展。首次接入真实数据前先用测试账本验证备份与恢复。

## 两台设备的验收顺序

- A 设置坚果云 WebDAV，使用专用应用密码，创建家庭并保存恢复码。凭据只填写在 App 内。
- B 使用无流水／计划／小金库的新账本，通过扫码或粘贴配对信息加入，填写同一共享目录可用的凭据及自己的成员名称。
- 双方各离线记录 10 笔；联网并保持前台后核对双方完整明细、余额、成员、预算；重复同步不产生重复流水。
- 分别修改同一笔、同时记录两笔还款、同时修改一组分摊，核对胜出记录及金额，保留测试备份。
- A 建立私有账户与备注，执行家庭互转；B 只看到方向与金额，不得看到私有账户名、备注或流水。检查服务端日志只有密文。
- A 使用 Face ID／设备密码解锁，切后台再返回必须锁定；测试取消、失败和多次快速切换。网页保持锁定是预期行为。
- 测试本地通知授权／拒绝／取消，确认还款 -3 天、结清 -30/-7 天、预付到期 -7 天规则及系统实际投递。
- 测试完整备份分享、文件选择、损坏备份拒绝、恢复确认、恢复后同步暂停。不要把同一完整备份复制为两台同时写入的设备。
- 另建测试安装，用账号、账本编号和恢复码从云端重建家庭；私有数据仅能从自己的本地完整备份恢复。
- 安装同 Bundle ID 新构建，确认旧流水和偏好保留。最后核对真机键盘、左右滑动、多选、相机、深浅色和小屏幕布局。

## 参考

- 坚果云 [WebDAV 帮助](https://help.jianguoyun.com/?tag=webdav)。App 默认根地址为 `https://dav.jianguoyun.com/dav/`。
- 工作流使用官方 [checkout](https://github.com/actions/checkout)、[setup-node](https://github.com/actions/setup-node)、[upload-artifact](https://github.com/actions/upload-artifact)；目前按其 v7 文档准备。

本文件提供执行与验收步骤，不代表外部服务、免费签名或系统通知已通过实测。
