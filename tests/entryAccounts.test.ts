import { entryAccountGroups } from "../src/domain/entryAccounts";
import { fixture } from "./sqlite";

test("entry separates own and other household accounts without exposing archived or deleted accounts", () => {
  const f = fixture();
  try {
    const data = f.repo.snapshot(), base = data.accounts[0]!;
    const rows = [
      { ...base, id: "partner", ownerMemberId: "partner", sort: 0 },
      { ...base, id: "mine2", ownerMemberId: data.meId, sort: 2 },
      { ...base, id: "mine1", ownerMemberId: data.meId, sort: 1 },
      { ...base, id: "shared", ownerMemberId: "", sort: 3 },
      { ...base, id: "private-partner", ownerMemberId: "partner", scope: "private" as const },
      { ...base, id: "deleted", deleted: true },
      { ...base, id: "archived", archived: true },
    ];
    const original = structuredClone(rows), groups = entryAccountGroups(rows, data.meId);
    expect(groups.mine.map(a => a.id)).toEqual(["mine1", "mine2"]);
    expect(groups.more.map(a => a.id)).toEqual(["partner", "shared"]);
    expect(entryAccountGroups(rows, "missing").mine).toEqual([]);
    expect(rows).toEqual(original);
  } finally { f.sqlite.close(); }
});
