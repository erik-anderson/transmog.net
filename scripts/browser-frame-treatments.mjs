import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { createBrowserFrameRenderer } from "./browser-frame.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, ".cache/browser-frame-treatments");
const manifest = JSON.parse(await readFile(resolve(root, "screenshot-manifest.json"), "utf8"));
const spec = JSON.parse(await readFile(resolve(root, "screenshot-source.json"), "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
await mkdir(output, { recursive: true });
const renderer = await createBrowserFrameRenderer(root, spec);
const treatments = { joined: "Joined tab", raised: "Raised tab", floating: "Floating tab", compact: "Compact tab" };
const images = {};
try {
  for (const [treatment, label] of Object.entries(treatments)) {
    for (const [response, name] of Object.entries({ original: "preview-original.png", modified: "preview-css-change.png" })) {
      const source = PNG.sync.read(await readFile(resolve(root, "assets/screenshots", name)));
      const { content } = manifest.images[name];
      const snapshot = new PNG({ width: content.width, height: content.height });
      PNG.bitblt(source, snapshot, content.x, content.y, content.width, content.height, 0, 0);
      assert.equal(hash(snapshot.data), content.rgbaSha256, "Preview content differs from its provenance");
      const { bytes } = await renderer.render(PNG.sync.write(snapshot), { treatment, response });
      const file = `${treatment}-${response}.png`;
      await writeFile(resolve(output, file), bytes);
      images[file] = {
        treatment: label, response, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20),
        sha256: hash(bytes), contentSha256: content.rgbaSha256,
      };
      console.log(`Captured ${label}, ${response}`);
    }
  }
  await writeFile(resolve(output, "manifest.json"), JSON.stringify({
    ...renderer.provenance, density: spec.deviceScaleFactor, mirroredArrows: true, images,
  }, null, 2) + "\n");
} finally {
  await renderer.close();
}
