import type { AccountKind } from "../domain/types";
export type InlineItem = {
  id: string;
  name: string;
  subtitle?: string;
  amount?: string;
  symbol?: string;
  accountKind?: AccountKind;
  leading?: string;
  trailing?: string;
};
export type InlineListProps = {
  items: InlineItem[];
  maxHeight?: number;
  onReorder: (ids: string[]) => void;
  onPress?: (id: string) => void;
  onAction?: (id: string, action: string) => void;
  onError: (message: string) => void;
};
