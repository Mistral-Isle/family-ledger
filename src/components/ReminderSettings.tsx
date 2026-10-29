import { useEffect, useState } from "react";
import { useLedger } from "./LedgerProvider";
import { updateReminders, requestReminders } from "../services/reminders";
import { Button, Card, ErrorText, Txt } from "./ui";
import { zh } from "../i18n/zh";
export function ReminderSettings() {
  const { data, repo, run } = useLedger();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const enabled = repo.remindersEnabled();
  useEffect(() => {
    updateReminders(data, enabled).catch((e) => setError(String(e)));
  }, [data, enabled]);
  return (
    <Card>
      <Txt>{zh.reminders.hint}</Txt>
      <Button
        secondary
        disabled={busy}
        label={enabled ? zh.reminders.disable : zh.reminders.enable}
        onPress={() => {
          setBusy(true);
          setError("");
          (async () => {
            if (!enabled) await requestReminders();
            run(() => repo.setRemindersEnabled(!enabled));
          })()
            .catch((e) => setError((e as Error).message))
            .finally(() => setBusy(false));
        }}
      />
      <ErrorText message={error} />
    </Card>
  );
}
