import { useRouter } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { useVault, vaultAuthentication } from "../state/vault";
import { Button, Card, ErrorText, Heading, IconButton, Page, Txt } from "./ui";
import { zh } from "../i18n/zh";
export function VaultGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      vaultAuthentication.invalidate();
    };
  }, []);
  const { unlocked } = useVault();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (unlocked) return <>{children}</>;
  return (
    <Page>
      <Heading
        title={zh.vault.title}
        action={
          <IconButton
            name="xmark"
            label={zh.close}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/")
            }
          />
        }
      />
      <Card>
        <Txt>{Platform.OS === "web" ? zh.vault.web : zh.vault.locked}</Txt>
      </Card>
      <ErrorText message={error} />
      <Button
        disabled={busy || Platform.OS === "web"}
        label={zh.vault.unlock}
        onPress={() => {
          setBusy(true);
          setError("");
          const token = vaultAuthentication.begin(AppState.currentState);
          LocalAuthentication.authenticateAsync({
            promptMessage: zh.vault.unlock,
            cancelLabel: zh.cancel,
            disableDeviceFallback: false,
          })
            .then((result) => {
              if (!mounted.current) return;
              if (!vaultAuthentication.complete(token, result.success))
                setError(zh.vault.failed);
            })
            .catch((e) => setError(String(e)))
            .finally(() => setBusy(false));
        }}
      />
    </Page>
  );
}
