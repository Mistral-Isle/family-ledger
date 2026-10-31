import { DateField } from "../components/DateField";
import { useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useLedger } from "../components/LedgerProvider";
import {
  Button,
  Card,
  ErrorText,
  Field,
  Heading,
  IconButton,
  Page,
  Row,
  Txt,
  confirmAction,
} from "../components/ui";
import { TxnMetadata } from "../components/TxnMetadata";
import { categoryPath, memberName, tripSummary } from "../domain/travel";
import { formatMoney } from "../domain/money";
import { tripExportSheets, excelBytes, csvText } from "../domain/export";
import { saveReport } from "../services/reportFiles";
import type { Trip } from "../domain/types";
import { zh } from "../i18n/zh";

type Draft = {
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
  ended: boolean;
};
export default function Trips() {
  const { data, repo, run } = useLedger(),
    router = useRouter(),
    c = zh.collaboration;
  const params = useLocalSearchParams<{ id?: string }>();
  const [selected, setSelected] = useState(params.id ?? ""),
    [draft, setDraft] = useState<Draft | null>(null),
    [error, setError] = useState("");
  const trip = data.trips?.find((x) => x.id === selected && !x.deleted),
    current = repo.currentTripId();
  const summary = trip ? tripSummary(data, trip.id) : null;
  const perform = (fn: () => void) => {
    try {
      run(fn);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  function edit(t?: Trip) {
    setDraft({
      id: t?.id,
      name: t?.name ?? "",
      startDate: t?.startDate ?? "",
      endDate: t?.endDate ?? "",
      ended: t?.ended ?? false,
    });
  }
  async function download(format: "xlsx" | "csv") {
    if (!trip) return;
    try {
      const sheets = tripExportSheets(data, trip.id),
        name = trip.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
      await saveReport(
        `${name}.${format}`,
        format === "xlsx" ? excelBytes(sheets) : csvText(sheets[0]!),
        format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv;charset=utf-8",
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Page>
      <Heading
        title={trip?.name ?? c.tripTitle}
        action={
          <IconButton
            name="xmark"
            label={zh.close}
            onPress={() => (trip ? setSelected("") : router.back())}
          />
        }
      />
      <ErrorText message={error} />
      {draft ? (
        <Card>
          <Field
            label={c.tripName}
            value={draft.name}
            maxLength={30}
            onChangeText={(name) => setDraft({ ...draft, name })}
          />
          <DateField
            label={c.startDate}
            value={draft.startDate}
            optional
            onChange={(startDate) => setDraft({ ...draft, startDate })}
          />
          <DateField
            label={c.endDate}
            value={draft.endDate}
            optional
            onChange={(endDate) => setDraft({ ...draft, endDate })}
          />
          <Button
            label={zh.save}
            onPress={() =>
              perform(() => {
                const id = repo.saveTrip({
                  ...draft,
                  startDate: draft.startDate.trim() || null,
                  endDate: draft.endDate.trim() || null,
                });
                setSelected(id);
                setDraft(null);
              })
            }
          />
          <Button secondary label={zh.cancel} onPress={() => setDraft(null)} />
        </Card>
      ) : trip && summary ? (
        <>
          <Card>
            <Txt>
              {trip.ended ? c.ended : current === trip.id ? c.current : c.trip}
            </Txt>
            <Txt size={13}>
              {[trip.startDate, trip.endDate].filter(Boolean).join(" — ")}
            </Txt>
            <Txt>{c.tripTotal}</Txt>
            <Txt size={32} bold>
              {formatMoney(summary.total)}
            </Txt>
            {summary.members.map(([id, amount]) => (
              <Row key={id}>
                <Txt style={{ flex: 1 }}>{memberName(data, id)}</Txt>
                <Txt>{formatMoney(amount)}</Txt>
              </Row>
            ))}
            <Txt size={12}>{c.tripHint}</Txt>
          </Card>
          <Card>
            {!trip.ended && (
              <Button
                label={current === trip.id ? c.stopCurrent : c.makeCurrent}
                onPress={() =>
                  perform(() =>
                    repo.setCurrentTrip(current === trip.id ? null : trip.id),
                  )
                }
              />
            )}
            <Button
              secondary
              label={trip.ended ? c.reopenTrip : c.finishTrip}
              onPress={() =>
                perform(() => repo.saveTrip({ ...trip, ended: !trip.ended }))
              }
            />
            <Button secondary label={c.editTrip} onPress={() => edit(trip)} />
            <Button
              secondary
              label={c.exportExcel}
              onPress={() => void download("xlsx")}
            />
            <Button
              secondary
              label={c.exportCsv}
              onPress={() => void download("csv")}
            />
          </Card>
          <Card>
            {summary.categories.map(([id, amount]) => (
              <Row key={id}>
                <Txt style={{ flex: 1 }}>{categoryPath(data, id)}</Txt>
                <Txt>{formatMoney(amount)}</Txt>
              </Row>
            ))}
          </Card>
          {summary.rows.map((txn) => (
            <Card key={txn.id}>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: txn.type === "refund" ? "/refund" : "/entry",
                    params: { id: txn.id },
                  })
                }
              >
                <TxnMetadata data={data} txn={txn} full />
              </Pressable>
            </Card>
          ))}
          <Button
            secondary
            label={c.deleteTrip}
            onPress={() =>
              confirmAction(
                c.deleteTrip,
                c.deleteTripHint(summary.rows.length),
                () =>
                  perform(() => {
                    repo.deleteTrip(trip.id);
                    setSelected("");
                  }),
              )
            }
          />
        </>
      ) : (
        <>
          <Txt size={14}>{c.tripEmpty}</Txt>
          <Button label={c.createTrip} onPress={() => edit()} />
          {data.trips
            ?.filter((x) => !x.deleted)
            .map((x) => (
              <Card key={x.id}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setSelected(x.id);
                    setError("");
                  }}
                >
                  <Row>
                    <Txt bold style={{ flex: 1 }}>
                      {x.name}
                    </Txt>
                    <Txt size={12}>
                      {x.ended ? c.ended : current === x.id ? c.current : ""}
                    </Txt>
                  </Row>
                  <Txt>{formatMoney(tripSummary(data, x.id).total)}</Txt>
                </Pressable>
              </Card>
            ))}
        </>
      )}
    </Page>
  );
}
