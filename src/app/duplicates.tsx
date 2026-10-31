import { useState } from "react";
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
import { TxnMetadata } from "../components/TxnMetadata";
import { zh } from "../i18n/zh";
export default function Duplicates() {
  const { data, repo, run } = useLedger(),
    router = useRouter(),
    c = zh.collaboration;
  const [error, setError] = useState("");
  const pairs = repo.duplicatePairs();
  const perform = (fn: () => void) => {
    try {
      run(fn);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Page>
      <Heading
        title={c.duplicateInbox}
        action={
          <IconButton
            name="xmark"
            label={zh.close}
            onPress={() => router.back()}
          />
        }
      />
      <Txt size={13}>{c.duplicateHint}</Txt>
      <ErrorText message={error} />
      {!pairs.length && <Txt>{c.noDuplicates}</Txt>}
      {pairs.map((p) => (
        <Card key={p.first.id + ":" + p.second.id}>
          <Txt bold>{p.strong ? c.duplicateTitle : c.weakTitle}</Txt>
          <TxnMetadata data={data} txn={p.first} full />
          <Button
            secondary
            label={c.viewExisting}
            onPress={() =>
              router.push({ pathname: "/entry", params: { id: p.first.id } })
            }
          />
          <TxnMetadata data={data} txn={p.second} full />
          <Button
            secondary
            label={c.viewExisting}
            onPress={() =>
              router.push({ pathname: "/entry", params: { id: p.second.id } })
            }
          />
          <Button
            label={c.distinct}
            onPress={() =>
              perform(() => repo.confirmDistinct(p.first.id, p.second.id))
            }
          />
          <Button
            secondary
            label={c.keepFirst}
            onPress={() =>
              confirmAction(c.keepFirst, c.deleteDuplicateHint, () =>
                perform(() => repo.deleteTxn(p.second.id)),
              )
            }
          />
          <Button
            secondary
            label={c.keepSecond}
            onPress={() =>
              confirmAction(c.keepSecond, c.deleteDuplicateHint, () =>
                perform(() => repo.deleteTxn(p.first.id)),
              )
            }
          />
        </Card>
      ))}
    </Page>
  );
}
