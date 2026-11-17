import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function browserFrameProvenance(root, spec) {
  return {
    rendererSha256: hash(await readFile(new URL(import.meta.url))),
    htmlSha256: hash(await readFile(resolve(root, spec.browserFrame.html))),
    controlsSha256: hash(await readFile(resolve(root, spec.windowFrame.rightTitleBar))),
    treatment: spec.browserFrame.treatment,
  };
}

export async function createBrowserFrameRenderer(root, spec) {
  const provenance = await browserFrameProvenance(root, spec);
  const density = spec.deviceScaleFactor;
  const border = spec.windowFrame.borderWidth * density;
  const controls = PNG.sync.read(await readFile(resolve(root, spec.windowFrame.rightTitleBar)));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: spec.previewViewport.width + 2, height: spec.previewViewport.height + 200 },
      deviceScaleFactor: density, locale: spec.locale, timezoneId: spec.timezoneId,
      colorScheme: spec.colorScheme, reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(pathToFileURL(resolve(root, spec.browserFrame.html)).href + "?capture&treatment=" + encodeURIComponent(spec.browserFrame.treatment));
    await page.evaluate(() => window.browserFrameReady);
    const headerPixels = await page.evaluate(() =>
      (document.querySelector(".title-bar").offsetHeight + document.querySelector(".toolbar").offsetHeight) * devicePixelRatio,
    );
    return {
      provenance: { ...provenance, browser: browser.version(), headerPixels },
      close: () => browser.close(),
      async render(bytes, { treatment = spec.browserFrame.treatment, response = "original" } = {}) {
        const snapshot = PNG.sync.read(bytes);
        await page.evaluate((settings) => window.renderBrowserFrame(settings), {
          treatment, response, density, snapshot: "data:image/png;base64," + bytes.toString("base64"),
          sourceWidth: snapshot.width, contentBounds: { x: 0, y: 0, width: snapshot.width, height: snapshot.height },
        });
        const framedBytes = await page.locator("#browser-window").screenshot({ animations: "disabled" });
        const image = PNG.sync.read(framedBytes);
        const region = (x, y, width, height) => {
          const pixels = new PNG({ width, height });
          PNG.bitblt(image, pixels, x, y, width, height, 0, 0);
          return pixels.data;
        };
        const arrows = await page.locator(".arrow").evaluateAll((nodes) => nodes.map((node) => {
          const box = node.getBoundingClientRect();
          return { x: box.x * devicePixelRatio, y: box.y * devicePixelRatio, width: box.width * devicePixelRatio, height: box.height * devicePixelRatio };
        }));
        const back = region(arrows[0].x, arrows[0].y, arrows[0].width, arrows[0].height);
        const mirrored = Buffer.alloc(back.length);
        for (let y = 0; y < arrows[0].height; y++)
          for (let x = 0; x < arrows[0].width; x++) {
            const from = (y * arrows[0].width + x) * 4;
            const to = (y * arrows[0].width + arrows[0].width - x - 1) * 4;
            back.copy(mirrored, to, from, from + 4);
          }
        assert.equal(hash(region(arrows[1].x, arrows[1].y, arrows[1].width, arrows[1].height)), hash(mirrored), "Forward arrow is not an exact mirror of Back");
        assert.equal(hash(region(image.width - border - controls.width, border, controls.width, controls.height)), hash(controls.data), "Window controls were resampled or altered");
        const x = border, y = image.height - border - snapshot.height;
        const rgbaSha256 = hash(snapshot.data);
        assert.equal(hash(region(x, y, snapshot.width, snapshot.height)), rgbaSha256, "Browser framing altered captured page pixels");
        assert.deepEqual(errors, []);
        return {
          bytes: framedBytes,
          content: { x, y, width: snapshot.width, height: snapshot.height, rgbaSha256 },
        };
      },
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
}
