# AEM Protocol

> Making AI image evolution visible.

Hi — and welcome 👋

This is a small prototype exploring a simple idea:

> What if images could carry a visible, human-readable history of how they’ve been edited?

AEM stands for **AI Edit Mark**.

---

## What this project is

AEM Protocol is a prototype for tracking how AI-generated images evolve over time.

Each image carries:

* a **visible state** (AI·0 → AI·9, EXT, X)
* a **hidden watermark**
* a **signed manifest**

Together, these form a lightweight provenance system.

---

<img width="1536" height="1024" alt="AEM_protocol_slide_def" src="https://github.com/user-attachments/assets/9daf1f09-dce7-497a-816d-b8021f2485a6" />


---

## Try it (quick flow)

If you're opening the demo for the first time:

1. Click **“New generated demo image → AI·0”**
2. Apply an edit (e.g. Brighten → AI·1)
3. Click **“Download package”**
4. Switch to **Verifier mode** and load the file

You should see:

* **Verified: AI·1**

Try the tamper test to see it break → **X**

---

## State model

AEM uses a simple, visible system:

| State  | Meaning                              |
| ------ | ------------------------------------ |
| AI·0–9 | AI origin + number of verified edits |
| EXT    | External origin (no AI claim)        |
| X      | Broken or unverifiable provenance    |

---

## Architecture Overview

```
          ┌────────────────────────────┐
          │        Editor (UI)         │
          │        (ui.js)             │
          └────────────┬───────────────┘
                       │
                       ▼
          ┌────────────────────────────┐
          │  Canonical Manifest Layer  │
          │       (manifest.js)        │
          └────────────┬───────────────┘
                       │
                       ▼
          ┌────────────────────────────┐
          │  Watermark / Image Layer   │
          │      (watermark.js)        │
          └────────────┬───────────────┘
                       │
                       ▼
          ┌────────────────────────────┐
          │     Storage / Transport    │
          │                            │
          │  Core:                     │
          │  - image (PNG)             │
          │  - manifest (JSON)         │
          │                            │
          │  Optional bundle:          │
          │  - aem_package.json        │
          └────────────┬───────────────┘
                       │
                       ▼
          ┌────────────────────────────┐
          │        Verifier            │
          └────────────────────────────┘
```

**Canonical manifest is signed.
Everything else is derived.**

The manifest is the source of truth.  
The image, watermark, and UI are derived from it and must remain outside the signed boundary to avoid circular dependencies.

---

## Key idea
**Trust lives in the manifest, not in the pixels.**
> The image shows the result.
> The manifest proves how it got there.

AEM separates:

* what users **see**
* from what systems can **verify**

---

## What you can do in the demo

* generate an image → `AI·0`
* apply trusted edits → `AI·1`, `AI·2`, …
* upload external images → `EXT`
* simulate broken trust → `X`
* export a package
* verify it
* test tampering

---

## Transport format

The demo uses a bundled file:

* `aem_package.json`

This contains:

* the image (as data URL)
* the manifest
* optional metadata

However:

> AEM Protocol itself is transport-agnostic.

The core system is:

* image + manifest

The package format is just a convenience layer.

---

## Storage model (future)

AEM Protocol is transport-agnostic and aligns naturally with object storage systems (e.g. S3-compatible APIs).

In such setups:

* images are stored as objects (e.g. `image.png`)
* manifests are stored as separate JSON objects
* a small set of AEM fields may be stored as object metadata
* image ↔ manifest linkage is verified via hashes

Example (conceptual):

```
images/<asset_id>.png
manifests/<asset_id>.json
```

Optional metadata on the image object:

* `aem-asset-id`
* `aem-state`
* `aem-manifest-hash`
* `aem-manifest-url`

The bundled `aem_package.json` used in this demo is a convenience format for export/import, not a requirement of the protocol.

---

## Known Limitations

This project is a prototype and has important limitations.

### Browser-based trust

* signing keys are stored in the browser
* no external trust authority
* users control their own signing identity

---

### Lightweight watermarking

* simple pixel encoding (LSB-style)
* not robust against compression, resizing, or adversarial edits

---

### No origin attestation

* `AI·0` is created locally
* no cryptographic proof from a generator

---

### Not adversarially secure

* detects simple tampering
* not hardened against determined attackers

---

### Prototype architecture

* recently modularized
* some cross-module dependencies remain fragile
* no automated tests

---

### No backend

* no key management
* no identity layer
* no revocation

---

## Intended use

AEM Protocol is intended for:

* experimentation
* design exploration
* discussion

It is **not a production-ready provenance system**.

---

## Why this exists

AI content currently lacks:

* visible edit history
* clear origin signals
* understandable trust indicators

AEM explores a simple idea:

> Can provenance be made visible, not just verifiable?

---

## Future direction

This prototype currently uses a bundled export format (`aem_package.json`) for simplicity.

However, AEM Protocol is designed to be **transport-agnostic** and aligns naturally with object storage systems (e.g. S3-compatible APIs).

### Likely evolution
In a more realistic integration:

* images are stored as objects (e.g. `image.png`)
* manifests are stored as separate JSON objects
* a small set of AEM fields may be stored as object metadata
* image ↔ manifest linkage is verified via hashes

### Why this matters
This avoids:

* large bundled files
* base64-encoded images
* tight coupling between storage and verification

And enables:

* scalable storage
* API-based workflows
* integration with AI platforms and marketplaces

### Example (conceptual)
```
images/<asset_id>.png
manifests/<asset_id>.json
```

With optional metadata:

* `aem-asset-id`
* `aem-state`
* `aem-manifest-hash`
* `aem-manifest-url`

The current package format remains useful for:

* demos
* testing
* single-file export/import

But it is not required by the protocol.

---

## Roadmap (v0.1)
This project is intentionally small, but a few improvements are planned:

### Stability
* reduce implicit cross-module dependencies
* make module boundaries clearer

### UX clarity
* add a simple guided flow (“Generate → Edit → Verify”)
* improve labeling (package vs manifest)

### Storage model alignment
* support image + manifest as separate inputs
* treat `aem_package.json` as demo format only

### Documentation
* clarify roles (generator, editor, verifier)
* expand integration examples



The goal is not to build a full system, but to explore a clear and usable model for AI provenance.

---

## ☕ Support

This project started as a small curiosity about how AI images evolve.

If you found it interesting, useful, or it sparked an idea — You are welcome.

No expectations — just appreciated 🙏

---

## License

MIT — use at your own risk.
