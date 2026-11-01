# 换电脑开发、GitHub 构建与 IPA 安装

## 当前版本与代码位置

2026-11-01：最新已验证发布为 **0.3.11 / build 15**，分支 `codex/sidestore-0-3-11`，提交 `8a0145c5c05d46f326df999b1c1e8bcfb01c8789`。

- 仓库：https://github.com/Mistral-Isle/family-ledger
- 本版构建：https://github.com/Mistral-Isle/family-ledger/actions/runs/41290951070
- 安装包名：`family-ledger-0.3.11-sidestore.ipa`
- 大小：16,537,958 字节；SHA-256：`dacc7047117bed7e06d227e1109b0bc0a5c79cf7e88c68d19d27a26078af7c4d`

默认分支可能落后于发布分支。以后操作时，以最新成功构建对应的分支和提交为准，不要只下载默认分支。上述分支是本次可复现的起点。

## 1. 换电脑取得代码

不依赖原电脑、D 盘路径或 Codex。本地可以使用 Windows；真正的 iOS 编译由 GitHub Actions 的 macOS 执行。

准备 Git、Node.js **22.16.0**（与当前 CI 一致），以及有仓库推送权限的 GitHub 账号。首次推送按 Git 的登录提示认证，不把令牌写进源码。

在 PowerShell 中进入自己选择的开发目录，然后执行：

```powershell
git clone --branch codex/sidestore-0-3-11 https://github.com/Mistral-Isle/family-ledger.git
cd family-ledger
node --version
npm ci
npm run check
npm run web
```

打开 `http://127.0.0.1:4173`。停止预览按 Ctrl+C。需要独立示例账本时运行：

```powershell
node scripts/preview.cjs --demo
```

打开 `http://127.0.0.1:4175`。示例数据库与正式网页预览分开。Face ID、触觉反馈、原生日历等仍需 iPhone 验证。

`npm ci` 使用提交的 lockfile，并自动执行 SQLite 网页补丁。不需要复制旧电脑的 `node_modules`、`.cache`、`.expo`、`tmp` 或 `ios`。保留仓库的 `modules`、资源、脚本和配置；原生工程在 CI 中自动生成。

也可以在 GitHub 切换到正确分支后 Download ZIP，但 ZIP 没有 Git 历史；后续开发提交推荐重新使用 `git clone`。

## 2. 修改、检查与提交

从上述起点创建下一版分支。下面的 0.3.12 / build 16 是下一版示例；若已使用，应换成更高版本：

```powershell
git switch -c codex/sidestore-0-3-12
```

修改代码后，同步更新：

- `app.json`：`expo.version` 为 `0.3.12`，`expo.ios.buildNumber` 为字符串 `"16"`。build number 每次正式打包递增。
- `package.json`：`version`。
- `package-lock.json`：顶层 `version` 和 `packages[""].version`。
- `src/i18n/zh.ts`：应用页面实际使用的顶层 `version` 文案。不要误把备份格式版本当成应用版本。

沿用 Bundle ID `com.dwigh.familyledger`，便于覆盖更新。检查、预览确认后提交：

```powershell
npm run check
git status --short
git diff
git add app.json package.json package-lock.json src modules tests docs README.md
git diff --cached --stat
git diff --cached --check
git commit -m "feat: release 0.3.12 build 16"
git push -u origin codex/sidestore-0-3-12
```

按实际修改补充暂存路径（例如 `scripts` 或 `.github`），提交前确认暂存区只含准备发布的内容。不要提交凭据、个人账本、备份或缓存。后续在同一分支继续修改时，检查后 `git add`、`git commit`、`git push` 即可。

## 3. GitHub 自动打包

进入仓库 → **Actions → Unsigned iOS build**。当前 `.github/workflows/ios-unsigned.yml` 会在推送 `codex/sidestore-*` 分支时自动运行；推送普通分支或 master 不会触发该规则。

打开对应任务，确认分支和提交号是刚推送的版本。流程为：安装依赖 → 类型检查及测试 → Expo prebuild → Xcode Release 真机 arm64 编译 → 生成 IPA → 上传产物。

全部步骤绿色且状态 Success 才算成功。有错误时展开失败步骤查看日志，修正后再次提交推送。仅运行 `npm run export:ios` 只能生成 JavaScript/Hermes 资源，不能生成 IPA。

此工作流禁用代码签名，不需要 Apple 证书、Apple Account 或 EAS 密钥。使用者安装时由 SideStore 签名。如果 Fork 仓库，需要在自己的仓库启用 Actions，并有相应的 Actions 使用额度和仓库权限。GitHub macOS 环境和外部依赖会更新，因此流程可复现，但不保证未来产物逐字节相同。

## 4. 下载、解压并按版本命名

成功任务页面底部 **Artifacts** 中下载 `family-ledger-unsigned`。下载通常得到 `family-ledger-unsigned.zip`，里面才是 `family-ledger-unsigned.ipa`。

下面命令从仓库根目录执行；把 ZIP 路径和目标版本改成实际值。示例使用新暂存目录，避免混入旧安装包：

```powershell
$downloadZip = 'E:\Chrome下载\family-ledger-unsigned.zip'
$releaseVersion = '0.3.12'
$extractDir = Join-Path ([System.IO.Path]::GetTempPath()) ('ledger-ipa-' + [guid]::NewGuid())
Expand-Archive -LiteralPath $downloadZip -DestinationPath $extractDir
$ipaFiles = @(Get-ChildItem -LiteralPath $extractDir -Recurse -Filter '*.ipa')
if ($ipaFiles.Count -ne 1) { throw '下载包内应有且只有一个 IPA' }
New-Item -ItemType Directory -Path '.\dist\releases' -Force | Out-Null
$targetIpa = Join-Path (Resolve-Path '.\dist\releases').Path ("family-ledger-$releaseVersion-sidestore.ipa")
if (Test-Path -LiteralPath $targetIpa) { throw '同名安装包已存在，请先核对版本，避免覆盖' }
Copy-Item -LiteralPath $ipaFiles[0].FullName -Destination $targetIpa
$ipaHash = Get-FileHash -LiteralPath $targetIpa -Algorithm SHA256
$hashFile = [System.IO.Path]::ChangeExtension($targetIpa, '.sha256')
($ipaHash.Hash.ToLower() + '  ' + [System.IO.Path]::GetFileName($targetIpa)) | Set-Content -LiteralPath $hashFile -Encoding ascii
Get-Item -LiteralPath $targetIpa | Select-Object FullName, Length
$ipaHash
```

重命名只改变文件名；可安装 IPA 已由云端生成。不能将源码 ZIP 或网页导出 ZIP 直接改后缀为 IPA。

核对下载任务的分支、提交和版本。首次算出的 SHA-256 是以后检查文件是否变化的依据，并不能单独证明版本正确；应同时保存构建链接、提交号、版本、build number 和文件大小。IPA 内 `Payload/*.app/Info.plist` 的 `CFBundleShortVersionString`、`CFBundleVersion`、`CFBundleIdentifier` 才是实际包信息；可在支持 ZIP 和 Apple plist 的工具中核验。

`dist/releases` 被 Git 忽略，克隆仓库不会获得历史安装包。当前工作流产物仅保留 **7 天**，请把下载的 IPA、校验文件及构建信息另行备份。过期后可从对应代码重新构建，但新产物的哈希可能不同。

## 5. 用 SideStore 安装或更新

1. 升级前在旧 App 的“我的 → 备份与恢复”导出完整备份。
2. 将命名后的 IPA 传到 iPhone“文件”。
3. 按现有 SideStore 配置连接所需 VPN，在 SideStore → My Apps →“＋”选择 IPA，完成签名安装。
4. 使用原 Apple Account 和相同 Bundle ID 覆盖安装，保留原 App 后核对版本与账本。不要先卸载旧 App。
5. 在真机验证原生账户对齐、金额键震动、Face ID，以及两台设备同步。CI 成功不等同于真机验收。

应用数据和同步凭据不会包含在 Git 源码中。换开发电脑不影响手机内账本；如要迁移实际数据，应另外保存完整备份、配对恢复信息及自己的 WebDAV 凭据。
