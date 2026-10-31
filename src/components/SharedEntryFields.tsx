import { useState } from "react";
import { Modal, View, ScrollView, Pressable, StyleSheet } from "react-native";
import {
  Button,
  Chip,
  Txt,
  useTheme,
  Field,
  ErrorText,
  IconButton,
  Row,
} from "./ui";
import { DateField } from "./DateField";
import { useLedger } from "./LedgerProvider";
import { zh } from "../i18n/zh";

export function SharedEntryFields({
  visible,
  onClose,
  tripId,
  onTrip,
  embedded = false,
}: {
  embedded?: boolean;
  visible: boolean;
  onClose: () => void;
  tripId: string | null;
  onTrip: (id: string | null) => void;
}) {
  const { data, repo, run } = useLedger(),
    t = useTheme(),
    c = zh.collaboration;
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const trip = data.trips?.find((x) => x.id === tripId && !x.deleted);
  function close() {
    setCreating(false);
    setError("");
    onClose();
  }
  function choose(id: string | null) {
    onTrip(id);
    close();
  }
  function perform(fn: () => void) {
    try {
      run(fn);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const content = (
    <View
      style={{
        backgroundColor: t.bg,
        padding: embedded ? 0 : 20,
        paddingBottom: embedded ? 0 : 36,
        maxHeight: embedded ? undefined : "80%",
        flexShrink: 1,
        gap: 16,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}
    >
      {!embedded && (
        <Row>
          <Txt bold size={20} style={{ flex: 1 }}>
            {creating ? c.createTrip : c.trip}
          </Txt>
          <IconButton name="xmark" label={zh.close} onPress={close} />
        </Row>
      )}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 14 }}
      >
        <ErrorText message={error} />
        {creating ? (
          <>
            <Field
              label={c.tripName}
              value={name}
              maxLength={30}
              onChangeText={setName}
            />
            <DateField
              label={c.startDate}
              value={startDate}
              optional
              onChange={setStartDate}
            />
            <DateField
              label={c.endDate}
              value={endDate}
              optional
              onChange={setEndDate}
            />
            <Button
              label={c.createAndLink}
              onPress={() =>
                perform(() => {
                  const id = repo.saveTrip({
                    name,
                    startDate: startDate || null,
                    endDate: endDate || null,
                    ended: false,
                  });
                  repo.setCurrentTrip(id);
                  choose(id);
                })
              }
            />
            <Button
              secondary
              label={zh.cancel}
              onPress={() => {
                setCreating(false);
                setError("");
              }}
            />
          </>
        ) : (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Chip
                label={c.noTrip}
                selected={!tripId}
                onPress={() => choose(null)}
              />
              {data.trips
                ?.filter((x) => !x.deleted)
                .map((x) => (
                  <Chip
                    key={x.id}
                    label={x.name + (x.ended ? ` · ${c.ended}` : "")}
                    selected={tripId === x.id}
                    onPress={() => choose(x.id)}
                  />
                ))}
            </View>
            <Txt size={12}>{c.tripHint}</Txt>
            <Button
              secondary
              label={c.createTrip}
              onPress={() => {
                setName("");
                setStartDate("");
                setEndDate("");
                setError("");
                setCreating(true);
              }}
            />
            {trip && !trip.ended && (
              <>
                <Button
                  secondary
                  label={c.finishTrip}
                  onPress={() =>
                    perform(() => {
                      repo.saveTrip({ ...trip, ended: true });
                      close();
                    })
                  }
                />
                <Txt size={12}>{c.finishTripHelp}</Txt>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
  if (embedded) return visible ? content : null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,.35)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={c.closeTripSheet}
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        {content}
      </View>
    </Modal>
  );
}
