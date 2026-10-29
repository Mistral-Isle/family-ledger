import { WebDAVStore } from "../src/services/webdav";
const config = {
  url: "https://dav.example.test/dav/",
  username: "家庭",
  password: "app-password",
  ledgerId: "family",
  keyHex: "01".repeat(32),
};
test("WebDAV lists only immediate same-origin children and preserves request safety", async () => {
  const fetcher = jest.fn(
    async () =>
      new Response(
        `<d:multistatus xmlns:d="DAV:"><d:href>/dav/family/</d:href><d:href>/dav/family/10-20.ops</d:href><d:href>/dav/family/1-9.ops</d:href><d:href>https://other.test/dav/family/leak</d:href><d:href>/dav/family/nested/file</d:href></d:multistatus>`,
        { status: 207 },
      ),
  );
  const store = new WebDAVStore(config, fetcher as typeof fetch);
  expect(await store.list("family")).toEqual(["1-9.ops", "10-20.ops"]);
  const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
  expect(init.redirect).toBe("error");
  expect(init.headers).toMatchObject({
    Depth: "1",
    Authorization:
      "Basic " + Buffer.from("家庭:app-password").toString("base64"),
  });
  await expect(store.get("../outside")).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
test("WebDAV accepts existing folders, reports HTTP status, bounds responses and moves atomically", async () => {
  const fetcher = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(new Response(null, { status: 405 }))
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockResolvedValueOnce(
      new Response("large", { headers: { "Content-Length": "30000000" } }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 201 }));
  const store = new WebDAVStore(config, fetcher);
  await store.mkdir("family");
  await expect(store.get("family/missing")).rejects.toMatchObject({
    status: 404,
  });
  await expect(store.get("family/large")).rejects.toThrow("过大");
  await store.move("family/a.tmp", "family/a.ops");
  expect(fetcher.mock.calls[3]![1]).toMatchObject({
    method: "MOVE",
    headers: {
      Destination: "https://dav.example.test/dav/family/a.ops",
      Overwrite: "T",
    },
  });
});
test("default fetch retains its global receiver required by browsers", async () => {
  const spy = jest.spyOn(globalThis, "fetch").mockImplementation(function (
    this: unknown,
  ) {
    expect(this).toBe(globalThis);
    return Promise.resolve(new Response(null, { status: 201 }));
  });
  try {
    await new WebDAVStore(config).mkdir("family");
    expect(spy).toHaveBeenCalledTimes(1);
  } finally {
    spy.mockRestore();
  }
});
