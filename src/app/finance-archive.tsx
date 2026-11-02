import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LeaseCard } from "../components/LeaseForm";
import { DepositCard } from "../components/DepositCard";
import { LoanCard } from "../components/LoanCard";
import { useLedger } from "../components/LedgerProvider";
import {
  Button,
  Card,
  ErrorText,
  Heading,
  IconButton,
  Page,
  Row,
  Txt,
} from "../components/ui";
import { leaseLinkedDepositIds } from "../domain/leaseDeposits";
import { zh } from "../i18n/zh";

/** Archived plans of one finance tab; records stay in details and statistics. */
export default function FinanceArchive() {
  const { kind = "rent" } = useLocalSearchParams<{ kind?: string }>();
  const { data, repo, run } = useLedger();
  const router = useRouter();
  const [error, setError] = useState("");
  const linked = leaseLinkedDepositIds(data);
  const plans = data.plans.filter(
    (p) =>
      !p.deleted &&
      !linked.has(p.id) &&
      JSON.parse(p.data).archived &&
      (kind === "rent" ? p.kind === "prepaid" : p.kind === kind),
  );
  const close = () =>
    router.canGoBack() ? router.back() : router.replace("/finance");
  return (
    <Page>
      <Heading
        title="已归档"
        action={<IconButton name="xmark" label={zh.close} onPress={close} />}
      />
      <ErrorText message={error} />
      {plans.map((p) =>
        JSON.parse(p.data).lease ? (
          <LeaseCard key={p.id} plan={p} />
        ) : p.kind === "deposit" ? (
          <DepositCard key={p.id} plan={p} />
        ) : p.kind === "loan" ? (
          <LoanCard key={p.id} plan={p} />
        ) : (
          <Card key={p.id} style={{ padding: 14 }}>
            <Row>
              <Txt bold style={{ flex: 1 }}>
                {p.name}
              </Txt>
              <Button
                secondary
                label="取消归档"
                onPress={() => {
                  try {
                    run(() => repo.archivePlan(p.id, false));
                    setError("");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              />
            </Row>
          </Card>
        ),
      )}
      {!plans.length && <Txt size={13}>没有已归档记录</Txt>}
    </Page>
  );
}
