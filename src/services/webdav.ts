import type { SyncConfig, SyncStore } from "../domain/sync";
import { validateSyncConfig } from "../domain/sync";
export class WebDAVStore implements SyncStore {
  private base: string;
  constructor(
    private config: SyncConfig,
    private fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {
    validateSyncConfig(config);
    this.base = config.url.replace(/\/+$/, "") + "/";
  }
  private url(path: string) {
    if (
      path
        .split("/")
        .some((p) => !/^([a-zA-Z0-9._-]+)$/.test(p) || p === "." || p === "..")
    )
      throw new Error("无效的同步路径");
    return this.base + path.split("/").map(encodeURIComponent).join("/");
  }
  private async request(
    path: string,
    method: string,
    body?: string,
    headers: Record<string, string> = {},
  ) {
    const bytes = new TextEncoder().encode(
      this.config.username + ":" + this.config.password,
    );
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await this.fetcher(this.url(path), {
        method,
        body,
        signal: controller.signal,
        redirect: "error",
        headers: { Authorization: "Basic " + btoa(binary), ...headers },
      });
      const limit = method === "PROPFIND" ? 2 * 1024 * 1024 : 20 * 1024 * 1024;
      if (Number(response.headers.get("Content-Length")) > limit)
        throw new Error("同步响应过大");
      const content = await response.text();
      if (content.length > limit) throw new Error("同步响应过大");
      return {
        ok: response.ok,
        status: response.status,
        text: async () => content,
      };
    } finally {
      clearTimeout(timer);
    }
  }
  async mkdir(path: string) {
    const r = await this.request(path, "MKCOL");
    if (![200, 201, 204, 405].includes(r.status))
      throw new Error(`WebDAV MKCOL ${r.status}`);
  }
  async list(path: string) {
    const r = await this.request(
      path,
      "PROPFIND",
      '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>',
      { Depth: "1", "Content-Type": "application/xml" },
    );
    if (!r.ok) throw new Error(`WebDAV PROPFIND ${r.status}`);
    const xml = await r.text();
    if (xml.length > 2 * 1024 * 1024) throw new Error("WebDAV 目录过大");
    const base = new URL(this.url(path) + "/");
    const names: string[] = [];
    for (const match of xml.matchAll(
      /<(?:[\w-]+:)?href(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w-]+:)?href\s*>/gi,
    )) {
      const href = match[1]!
        .trim()
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
      const url = new URL(href, base);
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname))
        continue;
      const relative = url.pathname
        .slice(base.pathname.length)
        .replace(/\/$/, "");
      if (relative && !relative.includes("/"))
        names.push(decodeURIComponent(relative));
    }
    return [...new Set(names)].sort(
      (a, b) =>
        Number(a.split("-")[0]) - Number(b.split("-")[0]) || a.localeCompare(b),
    );
  }
  async get(path: string) {
    const r = await this.request(path, "GET");
    if (!r.ok)
      throw Object.assign(new Error(`WebDAV GET ${r.status}`), {
        status: r.status,
      });
    const text = await r.text();
    if (text.length > 20 * 1024 * 1024) throw new Error("同步文件过大");
    return text;
  }
  async put(path: string, text: string) {
    const r = await this.request(path, "PUT", text, {
      "Content-Type": "application/octet-stream",
    });
    if (!r.ok) throw new Error(`WebDAV PUT ${r.status}`);
  }
  async move(from: string, to: string) {
    const r = await this.request(from, "MOVE", undefined, {
      Destination: this.url(to),
      Overwrite: "T",
    });
    if (!r.ok) throw new Error(`WebDAV MOVE ${r.status}`);
  }
}
