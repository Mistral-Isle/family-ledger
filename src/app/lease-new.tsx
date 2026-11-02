import { useLocalSearchParams, useRouter } from "expo-router";
import { LeaseForm } from "../components/LeaseForm";
import { useLedger } from "../components/LedgerProvider";
import { Heading, IconButton, Page } from "../components/ui";
import { zh } from "../i18n/zh";

/** New lease, or corrections to an existing one when opened with its id. */
export default function NewLease() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { data } = useLedger();
  const router = useRouter();
  // Opened from a link there may be no history to return to.
  const close = () =>
    router.canGoBack() ? router.back() : router.replace("/finance");
  const editing = edit
    ? data.plans.find((p) => p.id === edit && !p.deleted)
    : undefined;
  return (
    <Page>
      <Heading
        title={editing ? "修改租赁" : "新增租赁"}
        action={<IconButton name="xmark" label={zh.close} onPress={close} />}
      />
      <LeaseForm editing={editing} onSaved={close} onCancel={close} />
    </Page>
  );
}
