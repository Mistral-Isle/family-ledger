import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import QRCode from "react-native-qrcode-svg";
import { getRandomBytes, randomUUID } from "expo-crypto";
import { bytesToHex } from "@noble/ciphers/utils.js";
import { useLedger } from "../components/LedgerProvider";
import {
  Button,
  Card,
  Chip,
  ErrorText,
  Field,
  Heading,
  IconButton,
  Page,
  Txt,
  confirmAction,
  styles,
} from "../components/ui";
import { loadSyncConfig } from "../services/syncConfig";
import {
  configureSync,
  syncNow,
  withSyncLock,
  disconnectSync,
} from "../services/syncRuntime";
import {
  decryptOperations,
  encryptOperations,
  type SyncConfig,
} from "../domain/sync";
import { readBackupFile } from "../services/backupFiles";
import { saveReport } from "../services/reportFiles";
import { useSyncStatus } from "../state/sync";
import { zh } from "../i18n/zh";
export default function SyncSettings() {
  const { data, repo, refresh } = useLedger(),
    router = useRouter(),
    status = useSyncStatus();
  const [url, setUrl] = useState("https://dav.jianguoyun.com/dav/"),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [ledgerId, setLedgerId] = useState(""),
    [keyHex, setKeyHex] = useState(""),
    [name, setName] = useState(
      data.members.find((m) => m.id === data.meId)?.name ?? "",
    ),
    [joining, setJoining] = useState(false),
    [configured, setConfigured] = useState(false),
    [visible, setVisible] = useState(false),
    [pair, setPair] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  useEffect(() => {
    let active = true;
    loadSyncConfig()
      .then((c) => {
        if (!c || !active) return;
        setUrl(c.url);
        setUsername(c.username);
        setPassword(c.password);
        setLedgerId(c.ledgerId);
        setKeyHex(c.keyHex);
        setConfigured(true);
      })
      .catch((e) => setError(String(e)));
    return () => {
      active = false;
    };
  }, []);
  async function work(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function applyPair(raw: string) {
    try {
      const value = JSON.parse(raw);
      if (
        value.version !== 1 ||
        typeof value.url !== "string" ||
        typeof value.ledgerId !== "string" ||
        typeof value.keyHex !== "string" ||
        !/^[a-zA-Z0-9-]{1,64}$/.test(value.ledgerId) ||
        !/^([0-9a-f]{2}){32}$/i.test(value.keyHex) ||
        new URL(value.url).protocol !== "https:"
      )
        throw new Error(zh.sync.invalid);
      setUrl(value.url);
      setLedgerId(value.ledgerId);
      setKeyHex(value.keyHex);
      setJoining(true);
      setScanning(false);
      setPair("");
      setError("");
    } catch {
      setError(zh.sync.invalid);
    }
  }
  const pairing = JSON.stringify({ version: 1, url, ledgerId, keyHex });
  async function save() {
    if (joining && (!ledgerId || !keyHex)) throw new Error(zh.sync.invalid);
    const config: SyncConfig = {
      url: url.trim(),
      username: username.trim(),
      password,
      ledgerId: ledgerId || randomUUID(),
      keyHex: keyHex || bytesToHex(getRandomBytes(32)),
      allowCreate: !joining,
    };
    await configureSync(repo, config, joining, name);
    setLedgerId(config.ledgerId);
    setKeyHex(config.keyHex);
    setConfigured(true);
    setJoining(false);
    refresh();
    await syncNow(repo, refresh);
  }
  return (
    <Page>
      <Heading
        title={zh.sync.title}
        action={
          <IconButton
            name="xmark"
            label={zh.close}
            onPress={() => router.back()}
          />
        }
      />
      <Txt>{zh.sync.hint}</Txt>
      {Platform.OS === "web" && <Txt>{zh.sync.web}</Txt>}
      <Card>
        <Txt>
          {status.busy
            ? zh.sync.busy
            : status.last
              ? zh.sync.success +
                " · " +
                new Date(status.last).toLocaleString("zh-CN", {
                  timeZone: "Asia/Shanghai",
                })
              : configured
                ? zh.localOnly
                : zh.sync.offline}
        </Txt>
        <ErrorText message={error || status.error} />
        <Txt>{zh.queued(data.pending)}</Txt>
      </Card>
      {!configured && (
        <View style={styles.wrap}>
          <Chip
            label={zh.sync.create}
            selected={!joining}
            onPress={() => setJoining(false)}
          />
          <Chip
            label={zh.sync.join}
            selected={joining}
            onPress={() => setJoining(true)}
          />
        </View>
      )}
      <Field label={zh.sync.member} value={name} onChangeText={setName} />
      <Field
        label={zh.sync.url}
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
      />
      <Field
        label={zh.sync.username}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <Field
        label={zh.sync.password}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
      />
      {(joining || configured) && (
        <>
          <Field
            label={zh.sync.ledgerId}
            value={ledgerId}
            onChangeText={setLedgerId}
            autoCapitalize="none"
          />
          <Field
            label={zh.sync.key}
            value={keyHex}
            onChangeText={setKeyHex}
            secureTextEntry={!visible}
            autoCapitalize="none"
          />
        </>
      )}
      <Button
        disabled={busy || status.busy}
        label={zh.sync.save}
        onPress={() => {
          if (joining)
            confirmAction(
              zh.sync.join,
              zh.sync.joinWarning,
              () => void work(save),
            );
          else void work(save);
        }}
      />
      {configured && (
        <>
          <Button
            disabled={busy}
            secondary
            label={zh.sync.disconnect}
            onPress={() =>
              confirmAction(zh.sync.disconnect, zh.sync.disconnectHint, () => {
                void work(async () => {
                  await disconnectSync();
                  setConfigured(false);
                  setPassword("");
                  setKeyHex("");
                  setVisible(false);
                });
              })
            }
          />
          <Button
            disabled={busy || status.busy}
            secondary
            label={zh.sync.run}
            onPress={() => void work(() => syncNow(repo, refresh))}
          />
          <Button
            secondary
            label={visible ? zh.sync.hideKey : zh.sync.showKey}
            onPress={() => setVisible(!visible)}
          />
          {visible && (
            <Card>
              <Txt>{zh.sync.pairing}</Txt>
              <View
                style={{
                  alignSelf: "center",
                  backgroundColor: "white",
                  padding: 16,
                }}
              >
                <QRCode value={pairing} size={220} />
              </View>
              <Field
                label={zh.sync.recovery}
                value={pairing}
                multiline
                editable={false}
              />
            </Card>
          )}
          <Button
            secondary
            disabled={busy || status.busy}
            label={zh.sync.export}
            onPress={() =>
              void work(async () => {
                const c = await loadSyncConfig();
                if (!c) throw new Error(zh.sync.offline);
                await saveReport(
                  "family-sync-" + Date.now() + ".json",
                  encryptOperations(
                    repo.familySnapshotOperations(),
                    c.keyHex,
                    c.ledgerId,
                    getRandomBytes(24),
                  ),
                  "application/json",
                );
              })
            }
          />
          <Button
            secondary
            disabled={busy || status.busy}
            label={zh.sync.import}
            onPress={() =>
              void work(async () => {
                const text = await readBackupFile();
                if (text === null) return;
                await withSyncLock(async () => {
                  const c = await loadSyncConfig();
                  if (!c) throw new Error(zh.sync.offline);
                  repo.mergeOperations(
                    decryptOperations(text, c.keyHex, c.ledgerId),
                  );
                  refresh();
                });
              })
            }
          />
        </>
      )}
      {!configured && (
        <Card>
          <Field
            label={zh.sync.manual}
            value={pair}
            onChangeText={setPair}
            multiline
          />
          <Button
            secondary
            label={zh.sync.copy}
            onPress={() => applyPair(pair)}
          />
          <Button
            secondary
            label={zh.sync.scan}
            onPress={() => setScanning(true)}
          />
          {scanning && (
            <>
              {!permission?.granted ? (
                <Button
                  label={zh.sync.camera}
                  onPress={() => void requestPermission()}
                />
              ) : (
                <CameraView
                  style={{ height: 280 }}
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={({ data }) => applyPair(data)}
                />
              )}
              <Button
                secondary
                label={zh.sync.cancel}
                onPress={() => setScanning(false)}
              />
            </>
          )}
        </Card>
      )}
    </Page>
  );
}
