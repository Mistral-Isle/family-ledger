import { View } from "react-native";
import { Card, Row, Txt } from "./ui";
import { useLedger } from "./LedgerProvider";
import { totals, visibleTxns } from "../domain/selectors";
import { formatMoney } from "../domain/money";
import { payerId } from "../domain/travel";
import { zh } from "../i18n/zh";
export function MemberShare({ month }: { month: string }) {
  const { data } = useLedger();
  const rows = visibleTxns(data.txns).filter((t) =>
    t.occurredAt.startsWith(month),
  );
  const members = data.members
    .filter((m) => !m.deleted)
    .map((m) => ({
      ...m,
      amount: totals(rows.filter((t) => payerId(data, t) === m.id)).expense,
    }));
  members.push({
    id: "unknown",
    name: zh.collaboration.unknown,
    color: "#87919C",
    amount: totals(rows.filter((t) => !payerId(data, t))).expense,
    createdAt: "",
    updatedAt: "",
    hlc: "",
    deleted: false,
  });
  const total = members.reduce((sum, m) => sum + Math.max(0, m.amount), 0);
  return (
    <Card style={{ gap: 12 }}>
      <Txt bold>{zh.memberShare}</Txt>
      <View
        style={{
          flexDirection: "row",
          height: 6,
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        {members.map((m) => (
          <View
            key={m.id}
            style={{
              backgroundColor: m.color,
              width: `${total ? (Math.max(0, m.amount) * 100) / total : 0}%`,
            }}
          />
        ))}
      </View>
      {members.map((m) => (
        <Row key={m.id}>
          <View
            style={{
              height: 7,
              width: 7,
              borderRadius: 4,
              backgroundColor: m.color,
            }}
          />
          <Txt style={{ flex: 1 }}>{m.name}</Txt>
          <Txt>{formatMoney(m.amount)}</Txt>
          <Txt size={12}>
            {total ? Math.round((Math.max(0, m.amount) * 100) / total) : 0}%
          </Txt>
        </Row>
      ))}
    </Card>
  );
}
