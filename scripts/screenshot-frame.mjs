import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PNG } from "pngjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function loadScreenshotFrame(root, spec) {
  const settings = spec.windowFrame;
  assert.equal(settings.assetScaleFactor, spec.deviceScaleFactor, "Title bar assets must match the capture density");
  const border = settings.borderWidth * spec.deviceScaleFactor;
  assert.ok(Number.isInteger(border) && border > 0, "The frame border must cover whole physical pixels");
  const color = (hex) => {
    assert.match(hex, /^#[0-9a-f]{6}$/i);
    return [...Buffer.from(hex.slice(1), "hex"), 255];
  };
  const borderColor = color(settings.borderColor),
    titleBarColor = color(settings.titleBarColor);
  const assets = {};
  const load = async (path) => {
    const bytes = await readFile(resolve(root, path));
    const image = PNG.sync.read(bytes);
    // Copy these supplied captures at native size, without interpolation.
    for (let offset = 3; offset < image.data.length; offset += 4)
      assert.equal(image.data[offset], 255, "Title bar assets must be opaque");
    assets[path] = { sha256: sha256(bytes), width: image.width, height: image.height };
    return image;
  };
  const left = await load(settings.leftTitleBar),
    right = await load(settings.rightTitleBar);
  assert.equal(left.height, right.height, "Title bar assets must have matching heights");
  const fill = (image, x, y, width, height, rgba) => {
    const row = Buffer.alloc(width * 4);
    for (let offset = 0; offset < row.length; offset += 4) row.set(rgba, offset);
    for (let rowIndex = y; rowIndex < y + height; rowIndex++)
      row.copy(image.data, (rowIndex * image.width + x) * 4);
  };
  return {
    provenance: {
      rendererSha256: sha256(await readFile(new URL(import.meta.url))),
      assets,
      borderPixels: border,
      titleBarHeight: left.height,
    },
    render(bytes) {
      const capture = PNG.sync.read(bytes);
      assert.ok(capture.width >= left.width + right.width, "Title bar assets overlap");
      const framed = new PNG({ width: capture.width + 2 * border, height: capture.height + left.height + 2 * border });
      fill(framed, 0, 0, framed.width, framed.height, borderColor);
      fill(framed, border, border, capture.width, left.height, titleBarColor);
      PNG.bitblt(left, framed, 0, 0, left.width, left.height, border, border);
      PNG.bitblt(right, framed, 0, 0, right.width, right.height, border + capture.width - right.width, border);
      PNG.bitblt(capture, framed, 0, 0, capture.width, capture.height, border, border + left.height);
      return {
        bytes: PNG.sync.write(framed),
        content: { width: capture.width, height: capture.height, rgbaSha256: sha256(capture.data) },
      };
    },
  };
}
