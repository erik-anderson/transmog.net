# transmog.net

The concise, screenshot-led homepage for [Transmog](https://github.com/erik-anderson/transmog), a free, MIT-licensed web debugging proxy. Hosted by GitHub Pages at **https://transmog.net**.

The public site contains product presentation and download links. App tutorials and how-to documentation are deliberately deferred. This README is for website maintainers.

## Website development

Use Node.js 24 or newer. The published site is plain HTML, CSS, JavaScript and images; there is no runtime framework, database, analytics, third-party font request, or application backend.

```sh
npm ci
npx playwright install chromium
npm run build
npm run check
npm run preview
```

Open the printed localhost URL. `build` copies an explicit allowlist into `dist/`, excluding maintenance files. `check` exercises the published output, including narrow layouts, screenshots, keyboard navigation, focus restoration and JavaScript-disabled links. Its visual evidence is saved under ignored `test-results/`.

Pushes to `main` run the checks and publish `dist/`. Pull requests run the same checks without deploying. Download links go to the app's Releases page because its current builds are prereleases; GitHub's `/releases/latest` endpoint does not select Canary prereleases.

## Reproduce the product screenshots

The screenshots are the app's **production WebUI templates and client bundle**, rendered in the Chromium version pinned by the app's Playwright lockfile. The app's existing command fixture supplies the native bridge; `scripts/screenshot-fixture.mjs` supplies fictional `.test` traffic. This renders the desktop content, without Windows window borders. It never starts a real proxy, installs certificates, contacts an example server, or uses a personal capture.

1. Use a clean checkout of the application at the commit in `screenshot-source.json`. Keep it separate from ongoing app edits.
2. Prepare that checkout using the app's development prerequisites (Python 3.11+, Node 24+, and the native tools required by its `scripts/dev-env.py --check`). Install its locked UI and browser dependencies:

   ```sh
   npm --prefix /path/to/transmog/apps/desktop/ui ci
   npm --prefix /path/to/transmog/e2e/playwright ci
   ```

   From the app's `e2e/playwright` directory run `npx playwright install chromium`.
3. From this website repository run:

   ```sh
   npm run screenshots -- --app /path/to/transmog --python /path/to/python
   npm run build
   npm run check
   ```

   `--python` is optional when `TRANSMOG_PYTHON` or a working `python` (Windows) / `python3` is available. The script checks the app environment, rebuilds its UI, renders fixed data, selects request #4, captures the Traffic view, opens Timeline and shows all matches, then edits and sends a simulated Composer request. No desktop source files are modified.

The viewport, scale, theme, clock, locale and timezone are fixed in `screenshot-source.json`. `screenshot-manifest.json` records the app commit, fixture and dependency hashes, browser version, OS, Node version and image hashes. Use the same OS and installed fonts for pixel-identical output; Chromium font rendering differs across operating systems. The initial captures use Windows. The adapter reads the fixture block from the app's `check-workspaces.mjs`; if its explicit boundary changes, capture stops with an error instead of silently using a stale mock.

Add `--verify` to the capture command to render into ignored `.cache/screenshot-verify/` and compare the images byte for byte with the saved manifest, without replacing the site images.

### Refresh after an app update

Check out the intended new **committed** app revision, update its locked dependencies as needed, then run:

```sh
npm run screenshots -- --app /path/to/transmog --python /path/to/python --update-source
```

This updates the source pin, all three PNGs, and their manifest together. Review every image at full size and check the page before committing them. Keep examples fictional. Update selectors or the small fixture adapter if the app's commands or UI change. Do not redraw the app or patch captured pixels.

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
