import { createSubmissionGuard } from "../src/domain/submission";
import { fixture } from "./sqlite";

test("queued save taps commit one transaction; the next form can intentionally repeat it", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot();
    const input = {
      type: "expense" as const,
      amount: 100,
      accountId: s.accounts[0]!.id,
      categoryId: s.categories.find((c) => c.kind === "expense")!.id,
      occurredAt: "2026-10-30",
      note: "",
      forWhom: "both" as const,
    };
    const guard = createSubmissionGuard();
    const save = () => guard.run(() => f.repo.saveTxn(input));
    expect(save()).toBe(true);
    expect(save()).toBe(false);
    expect(f.repo.snapshot().txns).toHaveLength(1);
    expect(f.repo.snapshot().pending - s.pending).toBe(1);
    guard.reset();
    expect(save()).toBe(true);
    expect(f.repo.snapshot().txns).toHaveLength(2);
  } finally {
    f.sqlite.close();
  }
});

test("failed writes can be corrected and retried, and reentrant submissions are ignored", () => {
  const guard = createSubmissionGuard();
  const write = jest.fn();
  expect(() =>
    guard.run(() => {
      throw new Error("disk failure");
    }),
  ).toThrow("disk failure");
  expect(
    guard.run(() => {
      expect(guard.run(write)).toBe(false);
      write();
    }),
  ).toBe(true);
  expect(write).toHaveBeenCalledTimes(1);
});
