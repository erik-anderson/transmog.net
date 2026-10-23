import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { createHash, randomUUID, X509Certificate } from "node:crypto";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { marketingRecords, modifiedCSS } from "./marketing-page-fixture.mjs";

// The native probe uses the app's own command API and production event handlers,
// following its isolated native acceptance harness. No system proxy is started.
export async function captureNativeScreenshots() {
  const option = (name) => {
    const index = process.argv.indexOf(name);
    return index < 0 ? undefined : process.argv[index + 1];
  };
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const app = resolve(option("--app")),
    source = resolve(option("--native-executable"));
  const spec = JSON.parse(await readFile(join(root, "screenshot-source.json"), "utf8"));
  const git = (...args) => execFileSync("git", ["-C", app, ...args], { encoding: "utf8" }).trim();
  assert.equal(
    git("status", "--porcelain", "--untracked-files=no"),
    "",
    "App source must be clean",
  );
  const commit = git("rev-parse", "HEAD"),
    update = process.argv.includes("--update-source"),
    verify = process.argv.includes("--verify");
  assert.ok(!(update && verify), "Choose update or verify");
  if (!update) assert.equal(commit, spec.commit);
  execFileSync(
    option("--python") ?? process.env.TRANSMOG_PYTHON ?? "python",
    [join(app, "scripts/dev-env.py"), "--check"],
    { cwd: app, stdio: "inherit" },
  );
  const hash = async (path) =>
    createHash("sha256")
      .update(await readFile(path))
      .digest("hex");
  const executableSha256 = await hash(source);
  const workerNames = ["transmog-preview-worker.exe", "transmog-script-host.exe"];
  const workerSha256 = Object.fromEntries(
    await Promise.all(
      workerNames.map(async (name) => [name, await hash(join(dirname(source), name))]),
    ),
  );
  if (!update)
    assert.equal(
      executableSha256,
      spec.nativeExecutableSha256,
      "Native binary differs from the pinned screenshot source",
    );
  if (!update)
    assert.deepEqual(
      workerSha256,
      spec.workerSha256,
      "Native workers differ from the pinned release",
    );
  const run = join(root, ".cache", "native-" + randomUUID()),
    profile = join(run, "profile"),
    temporary = join(run, "temp");
  // Do not replace reviewed images until every capture and assertion succeeds.
  const output = join(run, "screenshots");
  await mkdir(profile, { recursive: true });
  await mkdir(temporary);
  await mkdir(output, { recursive: true });
  const executable = join(run, "transmog.exe");
  await copyFile(source, executable);
  for (const name of workerNames) await copyFile(join(dirname(source), name), join(run, name));
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    clients = [],
    errors = [];
  let child, main, browserVersion;
  const targets = async () => {
    const ports = new Set();
    const scan = async (path, depth = 0) => {
      if (depth > 12) return;
      for (const entry of await readdir(path, { withFileTypes: true }).catch(() => [])) {
        const next = join(path, entry.name);
        if (entry.isDirectory()) await scan(next, depth + 1);
        else if (entry.name === "DevToolsActivePort") {
          const port = Number((await readFile(next, "utf8")).split(/\r?\n/)[0]);
          if (port > 0) ports.add(port);
        }
      }
    };
    await scan(profile);
    await scan(temporary);
    const found = [];
    for (const port of ports)
      try {
        found.push(
          ...(await (
            await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) })
          ).json()),
        );
      } catch {}
    return found;
  };
  const connect = async (target) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    let sequence = 0;
    const pending = new Map();
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(String(data));
      if (message.id) {
        const request = pending.get(message.id);
        if (!request) return;
        pending.delete(message.id);
        clearTimeout(request.timer);
        if (message.error) request.reject(new Error(message.error.message));
        else request.resolve(message.result);
      } else if (message.method === "Runtime.exceptionThrown")
        errors.push(message.params.exceptionDetails);
    });
    const call = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++sequence,
          timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error("Timed out: " + method));
          }, 30000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    const evaluate = async (expression) => {
      let result;
      try {
        result = await call("Runtime.evaluate", {
          expression,
          awaitPromise: true,
          returnByValue: true,
        });
      } catch (error) {
        throw new Error(expression.slice(0, 200), { cause: error });
      }
      if (result.exceptionDetails)
        throw new Error(
          result.exceptionDetails.exception?.description ?? result.exceptionDetails.text,
        );
      return result.result.value;
    };
    await call("Runtime.enable");
    await call("Page.enable");
    await call("Emulation.setTimezoneOverride", { timezoneId: spec.timezoneId });
    await call("Emulation.setLocaleOverride", { locale: spec.locale });
    const client = { call, evaluate, close: () => socket.close() };
    clients.push(client);
    return client;
  };
  const waitFor = async (test, message = "Native screenshot state unavailable") => {
    const deadline = Date.now() + 45000;
    for (;;) {
      const result = typeof test === "string" ? await main.evaluate(test) : await test();
      if (result) return result;
      if (Date.now() > deadline) throw new Error(message);
      await delay(80);
    }
  };
  const images = {};
  const shot = async (client, name, { width, height } = spec.viewport) => {
    await client.call("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: spec.deviceScaleFactor,
      mobile: false,
    });
    await client.call("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-color-scheme", value: spec.colorScheme },
        { name: "prefers-reduced-motion", value: "reduce" },
      ],
    });
    // Native previews deliberately disable page scripts, including animation callbacks.
    await delay(250);
    const bytes = Buffer.from(
      (await client.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }))
        .data,
      "base64",
    );
    await writeFile(join(output, name + ".png"), bytes);
    images[name + ".png"] = {
      sha256: createHash("sha256").update(bytes).digest("hex"),
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
    console.log("Captured " + name);
  };
  try {
    child = spawn(executable, [], {
      env: {
        ...process.env,
        LOCALAPPDATA: profile,
        TEMP: temporary,
        TMP: temporary,
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=0 --remote-debugging-address=127.0.0.1 --lang=${spec.locale}`,
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let startup = "";
    child.stdout.on("data", (data) => {
      startup = (startup + data).slice(-16000);
    });
    child.stderr.on("data", (data) => {
      startup = (startup + data).slice(-16000);
    });
    child.on("error", (error) => errors.push(String(error)));
    const target = await waitFor(async () => {
      assert.equal(child.exitCode, null, "Native app exited: " + startup);
      return (await targets()).find(
        (row) => row.type === "page" && /transmog-ui|tauri/.test(row.url),
      );
    }, "Native app did not expose its isolated test target");
    main = await connect(target);
    browserVersion = await main.call("Browser.getVersion");
    await main.call("Emulation.setDeviceMetricsOverride", {
      ...spec.viewport,
      deviceScaleFactor: spec.deviceScaleFactor,
      mobile: false,
    });
    await waitFor("document.querySelector('app-shell')?.workspaceLoaded");
    const { nativeResponseSetContext } = await import(
      pathToFileURL(join(app, "apps/desktop/ui/scripts/native-response-set-helpers.mjs")).href
    );
    const h = nativeResponseSetContext({ main, waitFor }),
      { traffic, a, sets, invoke } = h;
    const { nativeFixture } = await import(
      pathToFileURL(join(app, "apps/desktop/ui/scripts/native-fixture.mjs")).href
    );
    await main.evaluate("document.querySelector('app-shell').dismissNotice()");
    const archive = join(run, "sample.tmcap");
    await writeFile(archive, nativeFixture(marketingRecords(spec.fixtureTime), 1));
    await main.evaluate(`${traffic}.importTrace(${JSON.stringify(archive)})`);
    await waitFor(`!${traffic}.importingTrace&&${traffic}.sessions.length===6`);
    await main.evaluate(`${traffic}.dismissImportStatus()`);
    const select = async (path) => {
      await main.evaluate(
        `(async()=>{const s=document.querySelector('app-shell');await s.activateView('traffic');const t=s.traffic;await t.inspectSession(t.sessions.find(row=>row.path===${JSON.stringify(path)}));})()`,
      );
      await waitFor(`!${traffic}.detailBusy`);
    };
    await select("/v1/products");
    await main.evaluate(
      `${traffic}.querySelector('message-inspector[side="response"]').querySelectorAll('button').forEach(b=>{if(b.textContent.trim()==='Body')b.click();})`,
    );
    await main.evaluate("document.activeElement?.blur()");
    await shot(main, "traffic");
    await select("/oauth/token");
    await waitFor(`${traffic}.querySelector('message-inspector[side="response"]')?.authCount>0`);
    await main.evaluate(
      `${traffic}.querySelector('message-inspector[side="response"]').querySelectorAll('button').forEach(b=>{if(/^Auth/.test(b.textContent))b.click();})`,
    );
    await waitFor(
      `${traffic}.querySelector('message-inspector[side="response"] auth-inspector')?.textContent.includes('fieldwork-web')`,
    );
    await main.evaluate(
      `${traffic}.toggleInspector();${traffic}.querySelector('message-inspector[side="request"]').querySelectorAll('button').forEach(b=>{if(/^Auth/.test(b.textContent))b.click();});`,
    );
    await waitFor(
      `${traffic}.querySelector('message-inspector[side="response"] auth-inspector .auth-finding .auth-finding')`,
    );
    await main.evaluate(
      `${traffic}.querySelector('message-inspector[side="response"] auth-inspector .auth-finding .auth-finding').scrollIntoView({block:'start'});document.activeElement?.blur();`,
    );
    await shot(main, "auth-inspection");
    await main.evaluate(`${traffic}.showTimings()`);
    await waitFor(`${traffic}.timingDialog.open&&!${traffic}.timingBusy`);
    await shot(main, "auth-timing");
    await main.evaluate(`${traffic}.closeTimings()`);
    await main.evaluate(`${traffic}.toggleInspector()`);
    const pageId = await main.evaluate(`${traffic}.sessions.find(row=>row.path==='/products').id`);
    const openPreview = async (options) => {
      const previous = new Set((await targets()).map((row) => row.id));
      await invoke("open_captured_page", {
        id: pageId,
        enableScripts: false,
        options,
        operationId: randomUUID(),
      });
      const target = await waitFor(async () =>
        (await targets()).find(
          (row) => !previous.has(row.id) && row.url === "https://shop.example.test/products",
        ),
      );
      const preview = await connect(target);
      await waitFor(() =>
        preview.evaluate("document.querySelectorAll('.products article').length===3"),
      );
      return preview;
    };
    const baseline = await openPreview({ scope: "original-trace" });
    await shot(baseline, "preview-original", spec.previewViewport);
    const setId = "fieldwork-response-changes";
    await h.captured("/assets/catalog.css", setId, "Fieldwork response changes");
    await main.evaluate(
      `(()=>{const input=${sets}.notesInput;input.value='Preview a response change on the captured shop.';input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
    await main.evaluate(
      `(()=>{const a=${a};a.autoResponseEditBody.checked=true;a.updateAutoResponseBodyEditState();a.autoResponseBody.value=${JSON.stringify(modifiedCSS)};a.autoResponseBody.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
    await h.save();
    const status = await h.associate(setId, pageId),
      owner = status.responseSets.find((row) => row.id === setId);
    await main.evaluate(
      `${a}.autoResponseBody.scrollIntoView({block:'center'});${a}.autoResponseBody.scrollTop=${a}.autoResponseBody.scrollHeight;document.activeElement?.blur()`,
    );
    await shot(main, "response-set-css");
    const selection = await main.evaluate(`${sets}.currentSelection()`);
    const modified = await openPreview({
      scope: "original-trace",
      variant: selection,
      pageReference: owner.previewPage,
    });
    await shot(modified, "preview-css-change", spec.previewViewport);
    assert.notEqual(
      await baseline.evaluate(
        "getComputedStyle(document.querySelector('.products')).gridTemplateColumns",
      ),
      await modified.evaluate(
        "getComputedStyle(document.querySelector('.products')).gridTemplateColumns",
      ),
    );
    const prepared = await invoke("prepare_demo_save", {
      operationId: randomUUID(),
      input: {
        ownerId: setId,
        name: "Fieldwork layout example",
        entryId: pageId,
        options: { scope: "original-trace", variant: selection, pageReference: owner.previewPage },
        replace: null,
      },
    });
    const demo = await invoke("commit_demo_save", {
      token: prepared.token,
      reviewedMissing: true,
      operationId: randomUUID(),
    });
    await invoke("clear_traffic");
    const beforeDemo = new Set((await targets()).map((row) => row.id));
    await invoke("open_saved_demo", {
      ownerId: setId,
      demo: { id: demo.id, revision: demo.revision },
      enableScripts: false,
      operationId: randomUUID(),
    });
    const demoTarget = await waitFor(async () =>
      (await targets()).find(
        (row) => !beforeDemo.has(row.id) && row.url === "https://shop.example.test/products",
      ),
    );
    const demoPage = await connect(demoTarget);
    await waitFor(() =>
      demoPage.evaluate("document.querySelectorAll('.products article').length===3"),
    );
    assert.equal(
      await demoPage.evaluate(
        "getComputedStyle(document.querySelector('.products')).gridTemplateColumns.split(' ').length",
      ),
      3,
    );
    // A separate synthetic TLS capture exercises the released certificate UI.
    // Its classical negotiated fields are illustrative, not a PQC benchmark.
    const chain = [];
    for (const name of ["leaf", "root"]) {
      const cert = new X509Certificate(
        await readFile(join(app, "crates/app/tests/fixtures/certificates", name + ".pem")),
      );
      chain.push({
        sha256: createHash("sha256").update(cert.raw).digest("hex"),
        der: [...cert.raw],
      });
    }
    const tls = {
      serverName: "localhost",
      serverChain: chain.map(({ sha256 }) => ({ sha256 })),
      clientChain: [],
      chainSource: "verification-path",
      offeredVersions: ["TLSv1.2", "TLSv1.3"],
      offeredCiphers: ["TLS_AES_128_GCM_SHA256"],
      offeredAlpn: ["h2", "http/1.1"],
      trustSource: "Fictional marketing capture",
      trustGeneration: 1,
      verification: "Verified",
      errors: [],
      details: {
        "Key exchange": "Classical key exchange",
        "Negotiated group": "X25519",
        "Negotiated group ID": "0x001d",
        "Peer handshake signature": "ecdsa_secp256r1_sha256",
        "Session resumed": "No",
      },
    };
    const performance = {
      points: [],
      protocols: [],
      transports: [
        {
          leg: "upstream",
          connectionId: "sample-origin",
          outcome: "connected",
          shared: false,
          sampledOffsetMicros: 0,
          peer: "127.0.0.1:443",
          local: "127.0.0.1:50000",
          dnsMicros: 1000,
          tcpMicros: 6000,
          tlsMicros: 18000,
          tlsVersion: "TLSv1.3",
          tlsResumed: false,
          cipher: "TLS_AES_128_GCM_SHA256",
          alpn: "h2",
          bytesRead: 2048,
          bytesWritten: 512,
          tls,
        },
      ],
    };
    const records = [
      ...chain.map((payload) => ({ exchange_id: 0, kind: "public-certificate", payload })),
      {
        kind: "request-head",
        payload: {
          boundary: "client-request",
          method: "GET",
          target: "https://localhost/sample-connection",
          headers: [],
        },
      },
      { kind: "response-head", payload: { boundary: "client-response", status: 200, headers: [] } },
      { kind: "performance", payload: performance },
      { kind: "completed", payload: null },
    ];
    const trace = join(run, "sample-tls.tmcap");
    await writeFile(trace, nativeFixture(records, 101));
    await main.evaluate(
      `(async()=>{await document.querySelector('app-shell').activateView('traffic');await ${traffic}.importTrace(${JSON.stringify(trace)});})()`,
    );
    await waitFor(
      `!${traffic}.importingTrace&&${traffic}.sessions.some(row=>row.path==='/sample-connection')`,
    );
    await select("/sample-connection");
    await main.evaluate(`${traffic}.showTimings()`);
    await waitFor(`${traffic}.timingDialog.open&&!${traffic}.timingBusy`);
    await main.evaluate(`${traffic}.showDetailsTab('certificates')`);
    await waitFor(`${traffic}.certificateInspector?.certificateServerChain.length===2`);
    await shot(main, "tls-certificates");
    await main.evaluate(`${traffic}.showDetailsTab('connection')`);
    await shot(main, "tls-connection");
    assert.deepEqual(errors, []);
    const capture = { ...spec, commit, nativeExecutableSha256: executableSha256, workerSha256 };
    const manifest = {
      source: spec.repository,
      commit,
      method: "released-native-webview2",
      node: process.version,
      platform: process.platform,
      browser: browserVersion.product,
      executableSha256,
      workerSha256,
      fixtureSha256: await hash(join(root, "scripts/marketing-page-fixture.mjs")),
      generatorSha256: await hash(fileURLToPath(import.meta.url)),
      capture,
      images,
      verification: {
        nativePagePreviews: true,
        distinctStylesheets: true,
        demoReopensAfterClear: true,
        tlsData: "synthetic classical connection with public fixture certificates",
      },
    };
    if (verify) {
      const previous = JSON.parse(await readFile(join(root, "screenshot-manifest.json"), "utf8"));
      assert.deepEqual(Object.keys(images).sort(), Object.keys(previous.images).sort());
      for (const [name, { width, height }] of Object.entries(images))
        assert.deepEqual(
          { width, height },
          { width: previous.images[name].width, height: previous.images[name].height },
          "Capture dimensions changed: " + name,
        );
      console.log(
        "Native screenshots regenerated; inspect .cache/screenshot-verify (native timestamps and fonts may differ).",
      );
    }
    const destination = join(root, verify ? ".cache/screenshot-verify" : "assets/screenshots");
    await mkdir(destination, { recursive: true });
    for (const name of Object.keys(images))
      await copyFile(join(output, name), join(destination, name));
    if (!verify)
      await writeFile(
        join(root, "screenshot-manifest.json"),
        JSON.stringify(manifest, null, 2) + "\n",
      );
    if (update)
      await writeFile(
        join(root, "screenshot-source.json"),
        JSON.stringify(capture, null, 2) + "\n",
      );
  } catch (error) {
    if (main)
      try {
        await writeFile(join(run, "failure.txt"), await main.evaluate("document.body.innerText"));
        await writeFile(
          join(run, "failure.png"),
          Buffer.from(
            (await main.call("Page.captureScreenshot", { format: "png" })).data,
            "base64",
          ),
        );
      } catch {}
    throw error;
  } finally {
    for (const client of clients) client.close();
    if (child && child.exitCode === null) {
      child.kill();
      await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(5000)]);
    }
    await writeFile(
      join(run, "owned-run.json"),
      JSON.stringify(
        {
          executable,
          source,
          executableSha256,
          commit,
          pid: child?.pid,
          stopped: child?.exitCode !== null || child?.signalCode !== null,
        },
        null,
        2,
      ),
    );
  }
}
