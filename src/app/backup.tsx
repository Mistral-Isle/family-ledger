import { withSyncLock } from "../services/syncRuntime";
import { clearSyncConfig } from "../services/syncConfig";
import { useSyncStatus } from "../state/sync";
import { VaultGate } from "../components/VaultGate";
import { useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useLedger } from "../components/LedgerProvider";
import {
  Button,
  Card,
  ErrorText,
  Heading,
  IconButton,
  Page,
  Txt,
  confirmAction,
} from "../components/ui";
import { zh } from "../i18n/zh";
import { saveBackupFile, readBackupFile } from "../services/backupFiles";
import { packBackup, unpackBackup } from "../services/backupFormat";
export default function BackupRoute() {
  const { data } = useLedger();
  return data.accounts.some((a) => a.scope === "private") ? (
    <VaultGate>
      <Backup />
    </VaultGate>
  ) : (
    <Backup />
  );
}
function Backup() {
  const { repo, run } = useLedger();
  const router = useRouter();
  const [pending, setPending] = useState<{
    text: string;
    preview: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function task(fn: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <Page>
      <Heading
        title={zh.backup.title}
        action={
          <IconButton
            name="xmark"
            label={zh.close}
            onPress={() => router.back()}
          />
        }
      />
      <Card>
        <Txt>{zh.backup.hint}</Txt>
      </Card>
      <Button
        disabled={busy}
        label={zh.backup.export}
        onPress={() =>
          void task(async () => {
            await saveBackupFile(await packBackup(repo.exportBackup()));
            setMessage(zh.backup.exported);
          })
        }
      />
      <Button
        disabled={busy}
        secondary
        label={zh.backup.import}
        onPress={() =>
          void task(async () => {
            setPending(null);
            const file = await readBackupFile();
            if (file === null) return;
            const text = await unpackBackup(file);
            const data = repo.inspectBackup(text);
            setPending({
              text,
              preview: zh.backup.preview(
                new Date(data.createdAt).toLocaleString("zh-CN", {
                  timeZone: "Asia/Shanghai",
                }),
                data.tables.account.length,
                data.tables.category.length,
                data.tables.txn.length,
              ),
            });
          })
        }
      />
      {pending && (
        <Card>
          <Txt>{pending.preview}</Txt>
          <Txt>{zh.backup.warning}</Txt>
          <Button
            disabled={busy}
            label={zh.backup.confirm}
            onPress={() =>
              confirmAction(
                zh.backup.confirm,
                zh.backup.warning,
                () =>
                  void task(async () => {
                    await withSyncLock(async () => {
                      await clearSyncConfig();
                      useSyncStatus.setState({
                        configured: false,
                        busy: false,
                        error: "",
                        last: "",
                      });
                      run(() => repo.restoreBackup(pending.text));
                    });
                    setPending(null);
                    setError("");
                    setMessage(zh.backup.done);
                  }),
              )
            }
          />
          <Button
            secondary
            disabled={busy}
            label={zh.backup.cancel}
            onPress={() => setPending(null)}
          />
        </Card>
      )}
      <ErrorText message={error} />
      {!!message && <Txt>{message}</Txt>}
    </Page>
  );
}
