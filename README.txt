AEM — EXT-aware Hover Demo

Included:
- index.html
- app.js
- styles.css

What changed:
- naming inside files uses AEM
- creation paths are split:
  - trusted generated demo image -> AI·0
  - uploaded image -> EXT
- app.js includes extensive comments:
  - main sections
  - substeps
  - short explanation per function
- styles.css includes section comments and layout notes
- index.html includes light structural comments

Validation:
- node --check app.js exit code: 0

This is still a prototype and still loads React from a CDN.


What we learned:
- a stable canonical manifest is required for reliable verification
- export-only fields should stay outside the signed manifest body
- hidden watermark data should reference the canonical manifest hash
- developers should treat signed provenance fields and derived export fields as separate layers


AEM update:
- UI labels use AEM / AEM Protocol consistently
- exported filenames now use:
  - aem_package.json
  - aem_manifest.json
  - aem_export.png

Light modularization step:
- app.js remains the live runtime file
- added reference files:
  - manifest.js
  - watermark.js
  - ui.js

These reference files make the intended future split clearer for developers,
without risking another break in the current prototype.


Real functional split:
- manifest.js now contains the actual manifest/signing/verifier helpers
- watermark.js now contains the actual image/watermark helpers
- ui.js now contains the actual React UI
- app.js is only the bootstrap file
