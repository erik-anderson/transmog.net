# Website guidance

Keep this site concise and screenshot-led. Transmog is free and open source; do not introduce sales, pricing, testimonials or unsupported platform claims. How-to documentation is deferred.

Use the existing logo and cream, ink, mint and amber palette. Keep the site usable without JavaScript. Screenshot links must retain direct image destinations and accessible names; the gallery must support Escape and restore focus.

Refresh app screenshots with `scripts/screenshots.mjs`, using a clean app checkout and the source pin. Do not manually edit screenshot pixels or fabricate UI. Keep sample traffic fictional and commit images, source pin and provenance together.

Run `npm run build` and `npm run check` after changes and inspect the generated desktop and mobile page captures. Publish only `dist/` through the Pages workflow. Do not run desktop release workflows for website changes.
