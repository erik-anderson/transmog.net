// Fictional page captured by Transmog. Both previews use these same bytes;
// only the saved stylesheet response differs. No remote resources or scripts.
export const originalCSS = `
:root { font-family: "Segoe UI", sans-serif; color: #233630; background: #f7f5ef; }
* { box-sizing: border-box; } body { margin: 0; }
header { display: flex; justify-content: space-between; padding: 24px 36px; border-bottom: 1px solid #d9ded6; font-size: 13px; }
header strong { letter-spacing: 3px; font-size: 16px; } header span { color: #69766e; }
main { padding: 32px 36px; } .eyebrow { font-size: 10px; letter-spacing: 2px; color: #65776c; }
h1 { font-weight: 500; font-size: 36px; letter-spacing: -1.4px; margin: 12px 0 8px; }
.intro { color: #6b756d; font-size: 14px; margin: 0 0 28px; }
.products { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
article { display: grid; grid-template-columns: 90px 1fr; gap: 8px; align-items: center; padding: 8px; background: white; border: 1px solid #e0e3db; }
.art { height: 108px; display: grid; place-items: center; background: #eceee4; }
svg { width: 82px; height: 88px; } h2 { font-size: 15px; font-weight: 600; margin: 0 0 7px; }
.description { font-size: 12px; line-height: 1.5; color: #738077; margin: 0 0 12px; }
.price { font-size: 13px; margin: 0; } .tag { font-size: 10px; color: #567661; margin-left: 8px; }
footer { font-size: 10px; color: #7e8a80; margin-top: 28px; letter-spacing: 1px; }
`;
export const modifiedCSS =
  originalCSS +
  `
.products { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
article { display: block; padding: 16px; }
.art { height: 144px; margin-bottom: 18px; }
h2 { font-size: 17px; } .description { min-height: 36px; }
`;
const products = [
  [
    "Desk lamp",
    "A warm glow for focused work.",
    "$48",
    '<path d="M45 45v36m-22 5h44M31 17h28l15 30H16z" fill="#b9cbbb" stroke="#4b6b54" stroke-width="3"/>',
  ],
  [
    "Everyday notebook",
    "Room for the next good idea.",
    "$12",
    '<rect x="19" y="10" width="53" height="76" rx="4" fill="#d9b48c" stroke="#9c704b" stroke-width="2"/><path d="M29 10v76M39 32h24M39 40h16" stroke="#9c704b" stroke-width="2"/>',
  ],
  [
    "Canvas carryall",
    "The essentials, ready to go.",
    "$32",
    '<path d="M20 34h51l7 51H13z" fill="#c6c5ad" stroke="#818569" stroke-width="2"/><path d="M31 39V25a14 14 0 0128 0v14" fill="none" stroke="#818569" stroke-width="4"/>',
  ],
];
export const pageHTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fieldwork · Everyday tools</title><link rel="stylesheet" href="/assets/catalog.css"></head><body><header><strong>FIELDWORK</strong><span>Everyday tools, thoughtfully chosen.</span></header><main><p class="eyebrow">THE DESK COLLECTION</p><h1>A little space to do good work.</h1><p class="intro">Simple things for the places where ideas happen.</p><section class="products">${products.map(([name, description, price, svg]) => `<article><div class="art"><svg viewBox="0 0 90 96" aria-hidden="true">${svg}</svg></div><div><h2>${name}</h2><p class="description">${description}</p><p class="price">${price}<span class="tag">In stock</span></p></div></article>`).join("")}</section><footer>FICTIONAL SHOP · TRANSMOG SAMPLE CAPTURE</footer></main></body></html>`;

export function marketingArchive(fixtureTime = "2026-10-01T12:00:00Z") {
  const base = Date.parse(fixtureTime);
  const token = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ iss: "https://auth.example.test", aud: "fieldwork-web", sub: "sample-user", scope: "catalog:read cart:write", iat: Math.floor(base / 1000), exp: Math.floor(base / 1000) + 3600 })).toString("base64url")}.`;
  const rows = [
    ["GET", "https://shop.example.test/products", "text/html", pageHTML, 0, 142],
    ["GET", "https://shop.example.test/assets/catalog.css", "text/css", originalCSS, 148, 60],
    [
      "POST",
      "https://auth.example.test/oauth/token",
      "application/json",
      JSON.stringify(
        {
          access_token: token,
          token_type: "Bearer",
          expires_in: 3600,
          scope: "catalog:read cart:write",
        },
        null,
        2,
      ),
      210,
      486,
    ],
    [
      "GET",
      "https://api.example.test/v1/products",
      "application/json",
      JSON.stringify(
        { products: products.map(([name, , price]) => ({ name, price, inStock: true })), total: 3 },
        null,
        2,
      ),
      710,
      186,
    ],
    [
      "GET",
      "https://api.example.test/v1/cart",
      "application/json",
      '{"items":[],"total":0}',
      734,
      132,
    ],
    [
      "GET",
      "https://api.example.test/v1/recommendations",
      "application/json",
      '{"products":[]}',
      748,
      318,
    ],
  ];
  return {
    log: {
      version: "1.2",
      creator: { name: "Transmog marketing sample", version: "1" },
      entries: rows.map(([method, url, mimeType, text, start, time], index) => ({
        startedDateTime: new Date(base + start).toISOString(),
        time,
        request: {
          method,
          url,
          httpVersion: "HTTP/2",
          headers: [
            { name: "Accept", value: mimeType },
            { name: "User-Agent", value: "Transmog sample client" },
            ...(index === 0 ? [{ name: "Sec-Fetch-Dest", value: "document" }] : []),
            ...(method === "POST"
              ? [{ name: "Content-Type", value: "application/x-www-form-urlencoded" }]
              : []),
          ],
          queryString: [],
          cookies: [],
          headersSize: -1,
          bodySize: 0,
          ...(method === "POST"
            ? {
                postData: {
                  mimeType: "application/x-www-form-urlencoded",
                  text: "grant_type=client_credentials&scope=catalog%3Aread",
                },
              }
            : {}),
        },
        response: {
          status: 200,
          statusText: "OK",
          httpVersion: "HTTP/2",
          headers: [
            { name: "Content-Type", value: mimeType + "; charset=utf-8" },
            { name: "Cache-Control", value: "no-store" },
            { name: "X-Request-ID", value: `sample-${index + 1}` },
          ],
          cookies: [],
          content: { size: Buffer.byteLength(text), mimeType, text },
          redirectURL: "",
          headersSize: -1,
          bodySize: Buffer.byteLength(text),
        },
        cache: {},
        timings: { blocked: 0, dns: 6, connect: 24, ssl: 18, send: 2, wait: time - 40, receive: 8 },
        serverIPAddress: "192.0.2.10",
      })),
    },
  };
}

// Synthetic native records use the released capture schema. Timing values are
// illustrative sample evidence, not measurements or performance benchmarks.
export function marketingRecords(fixtureTime) {
  const bytes = (value) => [...Buffer.from(value)];
  const headers = (values) =>
    values.map(({ name, value }) => ({ name: bytes(name), value: bytes(value) }));
  return marketingArchive(fixtureTime).log.entries.flatMap((entry, index) => {
    const start = Date.parse(entry.startedDateTime),
      duration = entry.time;
    const moments = [
      ["request-headers", 0],
      ["client-request-done", 1],
      ["route-begin", 1],
      ["route-done", 2],
      ["upstream-begin", 2],
      ["upstream-connected", 32],
      ["upstream-request-consumed", 34],
      ["response-headers", duration - 8],
      ["client-response-begin", duration - 7],
      ["upstream-response-first-body", duration - 7],
      ["client-response-first-body-queued", duration - 6],
      ["upstream-response-done", duration - 1],
      ["client-response-queued", duration],
      ["exchange-done", duration],
    ];
    const body = (boundary, text) => ({
      kind: "body-segment",
      payload: {
        boundary,
        byte_count: Buffer.byteLength(text),
        bytes: bytes(text),
        truncated: false,
      },
    });
    return [
      {
        kind: "exchange-started",
        payload: {
          client_addr: "127.0.0.1:50000",
          listener_addr: "127.0.0.1:8080",
          client_identity: { kind: "local-process", pid: 4242, name: "sample-client.exe" },
          authority: new URL(entry.request.url).host,
          started_unix_nanos: start * 1000000,
        },
      },
      {
        kind: "request-head",
        payload: {
          boundary: "client-request",
          method: entry.request.method,
          target: entry.request.url,
          headers: headers(entry.request.headers),
        },
      },
      body("client-request", entry.request.postData?.text ?? ""),
      {
        kind: "response-head",
        payload: {
          boundary: "client-response",
          status: 200,
          headers: headers(entry.response.headers),
        },
      },
      body("client-response", entry.response.content.text),
      {
        kind: "performance",
        payload: {
          points: moments.map(([milestone, offset]) => ({
            milestone,
            unixMillis: start + offset,
            offsetMicros: offset * 1000,
          })),
          protocols: [],
          transports: [
            {
              leg: "upstream",
              connectionId: "sample-" + index,
              outcome: "connected",
              shared: false,
              sampledOffsetMicros: duration * 1000,
              peer: "192.0.2.10:443",
              local: "192.0.2.20:50000",
              dnsMicros: 6000,
              tcpMicros: 6000,
              tlsMicros: 18000,
              setupTimings: [
                {
                  phase: "dns",
                  beganOffsetMicros: 2000,
                  endedOffsetMicros: 8000,
                  requestWaitMicros: 6000,
                },
                {
                  phase: "tcp",
                  beganOffsetMicros: 8000,
                  endedOffsetMicros: 14000,
                  requestWaitMicros: 6000,
                },
                {
                  phase: "tls",
                  beganOffsetMicros: 14000,
                  endedOffsetMicros: 32000,
                  requestWaitMicros: 18000,
                },
              ],
              tlsVersion: "TLSv1.3",
              cipher: "TLS_AES_128_GCM_SHA256",
              alpn: "h2",
              bytesRead: entry.response.bodySize,
              bytesWritten: 256,
            },
          ],
        },
      },
      { kind: "completed", payload: null },
    ].map((record) => {
      if (record.kind === "performance")
        record.payload.protocols = [
          "client-request",
          "upstream-request",
          "upstream-response",
          "client-response",
        ].map((boundary) => ({ boundary, version: "HTTP/2", reason: null }));
      return { ...record, exchange_id: index + 1 };
    });
  });
}
