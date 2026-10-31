import type { ReactNode } from "react";
import { useTheme } from "./ui";
export function TabBarSurface({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <div className={`ledger-tab-material ${t.dark ? "dark" : ""}`}>
      <style>{`.ledger-tab-material {position:absolute;bottom:0;left:0;right:0;background:rgba(255,255,255,.87);backdrop-filter:blur(24px) saturate(160%);border-radius:24px 24px 0 0;box-shadow:0 -4px 20px rgba(0,0,0,.05)} .ledger-tab-material.dark {background:#3C3F41} @media(prefers-reduced-transparency:reduce),(prefers-contrast:more) {.ledger-tab-material {background:#fff;backdrop-filter:none;border-top:1px solid #767680}.ledger-tab-material.dark {background:#3C3F41}}`}</style>
      {children}
    </div>
  );
}
