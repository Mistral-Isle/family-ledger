import { useLocalSearchParams, useRouter } from "expo-router";
import { DepositForm } from "../components/DepositCard";
import { useLedger } from "../components/LedgerProvider";
import { Heading, IconButton, Page } from "../components/ui";
import { zh } from "../i18n/zh";

/** New deposit, or corrections to one still held when opened with its id. */
export default function NewDeposit() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { data } = useLedger();
  const router = useRouter();
  // Opened from a link there may be no history to return to.
  const close = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: "/finance", params: { kind: "deposit" } });
  const editing = edit
    ? data.plans.find((p) => p.id === edit && !p.deleted)
    : undefined;
  return (
    <Page>
      <Heading
        title={editing ? "修改押金" : "新增押金"}
        action={<IconButton name="xmark" label={zh.close} onPress={close} />}
      />
      <DepositForm editing={editing} onSaved={close} onCancel={close} />
    </Page>
  );
}
