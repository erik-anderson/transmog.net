import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "./preview.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const index = process.argv.indexOf("--browser-root");
const require = createRequire(resolve(index < 0 ? root : process.argv[index + 1], "package.json"));
const { chromium } = require("playwright");
const source = JSON.parse(await readFile(resolve(root, "screenshot-source.json"), "utf8"));
const manifest = JSON.parse(await readFile(resolve(root, "screenshot-manifest.json"), "utf8"));
assert.equal(source.commit, manifest.commit);
assert.equal(source.nativeExecutableSha256, manifest.executableSha256);
assert.deepEqual(source.workerSha256, manifest.workerSha256);
assert.deepEqual(source, manifest.capture, "Capture settings differ from the screenshot manifest");
for (const [file, key] of [
  ["native-screenshots.mjs", "generatorSha256"],
  ["marketing-page-fixture.mjs", "fixtureSha256"],
])
  assert.equal(
    createHash("sha256")
      .update(await readFile(resolve(root, "scripts", file)))
      .digest("hex"),
    manifest[key],
    "Screenshot generator changed without refreshing provenance",
  );
assert.deepEqual(
  (await readdir(resolve(root, "assets/screenshots"))).sort(),
  Object.keys(manifest.images).sort(),
);
assert.deepEqual(
  (await readdir(resolve(root, "dist/assets/screenshots"))).sort(),
  Object.keys(manifest.images).sort(),
  "Publish output contains missing or retired screenshots",
);
for (const [name, meta] of Object.entries(manifest.images)) {
  const bytes = await readFile(resolve(root, "assets/screenshots", name));
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    meta.sha256,
    "Screenshot changed without refreshing provenance: " + name,
  );
  assert.equal(bytes.readUInt32BE(16), meta.width);
  assert.equal(bytes.readUInt32BE(20), meta.height);
  assert.equal(
    createHash("sha256")
      .update(await readFile(resolve(root, "dist/assets/screenshots", name)))
      .digest("hex"),
    meta.sha256,
    "Published screenshot differs from its source: " + name,
  );
}
assert.deepEqual(
  (await readdir(resolve(root, "dist"))).sort(),
  [
    ".nojekyll",
    "CNAME",
    "assets",
    "index.html",
    "robots.txt",
    "site.js",
    "sitemap.xml",
    "styles.css",
  ].sort(),
);
const { server, url } = await serve();
const browser = await chromium.launch({ headless: true });
await mkdir(resolve(root, "test-results"), { recursive: true });
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(r.status() + " " + r.url());
  });
  await page.goto(url);
  assert.equal(await page.locator("h1").count(), 1);
  assert.equal(await page.locator("[data-lightbox]").count(), 8);
  await page.keyboard.press("Tab");
  assert.equal(
    await page.locator(".skip-link").evaluate((e) => e === document.activeElement),
    true,
  );
  for (const size of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 360, height: 780 },
    { width: 320, height: 780 },
  ]) {
    await page.setViewportSize(size);
    await page.evaluate(async () => {
      for (const image of document.querySelectorAll("img[src]")) {
        image.loading = "eager";
        await image.decode();
      }
      await document.fonts.ready;
    });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      "Horizontal overflow at " + size.width,
    );
    assert.equal(
      await page
        .locator("img[src]")
        .evaluateAll((images) => images.every((i) => i.naturalWidth > 0)),
      true,
    );
    await page.locator(".editor-example summary").click();
    for (const link of await page.locator("[data-lightbox]").all()) {
      await link.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      assert.equal(await dialog.isVisible(), true);
      await dialog.locator("img").evaluate((image) => image.decode());
      for (const dimension of ["width", "height"])
        assert.equal(
          await dialog.locator("img").getAttribute(dimension),
          await link.locator("img").getAttribute(dimension),
        );
      assert.deepEqual(
        await dialog
          .locator(".lightbox-image")
          .evaluate((element) => ({ x: element.scrollLeft, y: element.scrollTop })),
        { x: 0, y: 0 },
        "New screenshot retained the previous pan position",
      );
      assert.equal(
        await dialog.locator("img").getAttribute("alt"),
        await link.locator("img").getAttribute("alt"),
      );
      assert.equal(
        await dialog.locator(".original-link").getAttribute("href"),
        await link.getAttribute("href").then((path) => url + "/" + path),
      );
      await dialog.locator(".lightbox-image").evaluate((element) => element.scrollTo(200, 200));
      await page.keyboard.press("Escape");
      assert.equal(await dialog.isVisible(), false);
      assert.equal(
        await link.evaluate((e) => e === document.activeElement),
        true,
        "Dialog did not restore focus",
      );
    }
    await page.locator(".editor-example summary").click();
    await page.evaluate(() => scrollTo(0, 0));
    if ([1440, 390].includes(size.width))
      await page.screenshot({
        path: resolve(root, "test-results/site-" + size.width + ".png"),
        fullPage: true,
        animations: "disabled",
      });
  }
  const link = page.locator("[data-lightbox]").first();
  await link.click();
  await page.getByRole("button", { name: "Close screenshot" }).click();
  assert.equal(await link.evaluate((e) => e === document.activeElement), true);
  for (const href of await page
    .locator('a[href^="#"]')
    .evaluateAll((links) => links.map((a) => a.getAttribute("href"))))
    assert.equal(await page.locator(href).count(), 1);
  await page.emulateMedia({ forcedColors: "active" });
  await link.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  assert.notEqual(await link.evaluate((e) => getComputedStyle(e).outlineStyle), "none");
  const noJS = await browser.newPage({ javaScriptEnabled: false });
  await noJS.goto(url);
  assert.equal(
    await noJS.locator("[data-lightbox]").first().getAttribute("href"),
    "assets/screenshots/traffic.png",
  );
  assert.equal(await noJS.getByRole("link", { name: "Download Windows preview" }).count(), 2);
  await noJS.locator(".editor-example summary").click();
  assert.equal(
    await noJS.getByRole("link", { name: "Enlarge the response editor screenshot" }).isVisible(),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Verified screenshots and publish files; responsive layouts from 320 to 1440 px; image loading; gallery pan reset, dimensions and keyboard focus return; anchors; forced-color focus; no-JavaScript links.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
