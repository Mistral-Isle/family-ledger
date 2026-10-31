import type { Snapshot, Txn } from "../domain/types";
import {
  categoryPath,
  effectiveTripId,
  memberName,
  payerId,
} from "../domain/travel";
import { formatMoney } from "../domain/money";
import { Txt } from "./ui";
import { View } from "react-native";
import { zh } from "../i18n/zh";
export function TxnMetadata({
  data,
  txn,
  full = false,
}: {
  data: Snapshot;
  txn: Txn;
  full?: boolean;
}) {
  const trip = data.trips?.find((t) => t.id === effectiveTripId(data, txn));
  const payer = memberName(data, payerId(data, txn)),
    recorder = memberName(data, txn.recorderMemberId);
  const account = data.accounts.find((a) => a.id === txn.accountId);
  if (!full && !trip && !txn.excludeBudget && !txn.excludeTotals) return null;
  return (
    <View style={{ gap: 4 }}>
      {full && (
        <Txt bold>
          {formatMoney(txn.amount)} · {txn.occurredAt} {txn.occurredTime ?? ""}
        </Txt>
      )}
      {full && (
        <Txt size={13}>
          {categoryPath(data, txn.categoryId)} · {account?.name}
        </Txt>
      )}
      {full ? (
        <Txt size={12}>
          {txn.type === "expense" || txn.type === "refund"
            ? `${payer}${zh.collaboration.paid} · `
            : ""}
          {recorder}
          {zh.collaboration.recorded}
          {trip ? ` · ${trip.name}` : ""}
        </Txt>
      ) : trip ? (
        <Txt size={12}>{trip.name}</Txt>
      ) : null}
      {(txn.excludeBudget || txn.excludeTotals) && (
        <Txt size={12}>
          {[txn.excludeBudget && "不计预算", txn.excludeTotals && "不计收支"]
            .filter(Boolean)
            .join(" · ")}
        </Txt>
      )}
      {full && !!txn.note && <Txt size={12}>{txn.note}</Txt>}
    </View>
  );
}
