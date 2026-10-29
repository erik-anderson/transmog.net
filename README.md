# transmog.net

The concise, screenshot-led homepage for [Transmog](https://github.com/erik-anderson/transmog), a free, MIT-licensed web debugging proxy. Hosted by GitHub Pages at **https://transmog.net**.

The public site contains product presentation and download links. App tutorials and how-to documentation are deliberately deferred. This README is for website maintainers.

## Website development

Use Node.js 24 or newer. The published site is plain HTML, CSS, JavaScript and images; there is no runtime framework, database, analytics, third-party font request, or application backend.

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run build
npm run check
npm run preview
```

Open the printed localhost URL. `build` copies an explicit allowlist into `dist/`, excluding maintenance files. `check` exercises the published output, including narrow layouts, screenshots, keyboard navigation, focus restoration and JavaScript-disabled links. Its visual evidence is saved under ignored `test-results/`.

Pushes to `main` run the checks and publish `dist/`. Pull requests run the same checks without deploying. Download links go to the app's Releases page because its current builds are prereleases; GitHub's `/releases/latest` endpoint does not select Canary prereleases.

## Reproduce the product screenshots

The nine screenshots come from the **released Windows app**, including its native captured-page previews. The current source is v0.1.15 Canary; `screenshot-source.json` pins its source commit and hashes for the app, CLI, and both worker executables. The release installer and CLI were checked against the release's published `SHA256SUMS` before extraction.

The generator imports fictional `.test` traffic into an isolated temporary profile. It uses production commands and controls, without changing app templates or screenshot pixels. It never starts a proxy, installs certificates, or uses a personal capture. Timing and TLS metadata are synthetic examples, not performance measurements. Certificate screenshots use the app's public test certificates; the illustrated TLS connection uses classical X25519. PQC capability statements are grounded in the released implementation, not inferred from that screenshot.

1. Use a clean checkout of the application at the commit in `screenshot-source.json`. Keep it separate from ongoing app edits.
2. Use Windows with WebView2, Python 3.11+, Node 24+, and the native tools required by the app's `scripts/dev-env.py --check`. Extract the pinned release installer into a separate directory, retaining `transmog.exe`, `transmog-cli.exe`, `transmog-preview-worker.exe`, and `transmog-script-host.exe` together. The screenshot generator does not build or install the application.
3. From this website repository run:

   ```sh
   npm run screenshots -- --app /path/to/transmog --native-executable /path/to/extracted/transmog.exe --python /path/to/python
   npm run build
   npm run check
   ```

   `--python` is optional when `TRANSMOG_PYTHON` or a working `python` is available. The script checks the app environment, copies the release executables into an owned temporary directory, imports the fixture, and captures Traffic, Auth, timing, response editing, previews, certificates, connection details, and MCP rule collaboration. It waits for visible JSON syntax colors, verifies that the modified preview differs and that a saved demo reopens after clearing Traffic, and uses the real MCP connector to prepare a disabled, agent-attributed header rule. The disposable access key stays scoped to the fictional API with default redaction and is revoked after capture. No desktop source files are modified.

The app viewport is 1440 × 900 and the preview viewport is 900 × 600, both at 2× scale. The generator applies the viewports, scale, sample capture time, locale, theme, and timezone from `screenshot-source.json`. `screenshot-manifest.json` records the app commit, executable, fixture and generator hashes, WebView2 version, OS, Node version, dimensions, and image hashes. The generator uses helpers from the pinned app checkout, stages images until all capture assertions pass, and records cleanup evidence under ignored `.cache/`.

Add `--verify` to render into ignored `.cache/screenshot-verify/` without replacing the site images. This repeats the behavioral assertions and checks the image inventory; review the regenerated images visually because native browser and font updates can change pixels. `npm run check` verifies the exact published image hashes and generator provenance without launching the desktop app.

### Refresh after an app update

Check out the intended **released** app revision, verify and extract its release installer, then run:

```sh
npm run screenshots -- --app /path/to/transmog --native-executable /path/to/extracted/transmog.exe --python /path/to/python --update-source
```

This updates the source pin, all nine PNGs, and their manifest together. Review every image at full size and check the page before committing them. Keep examples fictional. Update selectors and fixture records when the app's commands or UI change. Do not redraw the app or patch captured pixels.

## Domain

GitHub Pages is configured for `transmog.net`. The domain currently uses Cloudflare nameservers (`gabe.ns.cloudflare.com` and `kia.ns.cloudflare.com`), so make the DNS changes in Cloudflare. Set all website records to **DNS only** (gray cloud), with proxying disabled:

| Type | Host | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | erik-anderson.github.io |

Replace conflicting web-hosting A/CNAME records at `@` and `www`. Preserve mail and other unrelated records. If the apex has existing AAAA records, remove them or replace them with GitHub's four addresses: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`. Use Auto TTL (or 3600 seconds).

After DNS resolves to GitHub and its certificate is issued, enable **Enforce HTTPS** in Settings → Pages. GitHub redirects `www` to the configured apex. Domain registration/renewal remains with the registrar. [GitHub's current DNS instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

MIT license. The logo and captured application UI originate in the MIT-licensed Transmog repository.
