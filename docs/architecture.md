# AEM Protocol — Architecture Notes

## Object storage integration (S3-compatible)

AEM Protocol is compatible with object storage systems such as S3-compatible APIs.

In this model:

* the image is stored as an object (e.g. `image.png`)
* the manifest is stored as a separate JSON object
* a small set of AEM fields may be stored as object metadata
* the relationship between image and manifest is verified via hashes

This avoids bundling large payloads and aligns with scalable storage systems.

---

Conceptual structure:

```
images/<asset_id>.png
manifests/<asset_id>.json
```

Optional metadata:

* aem-asset-id
* aem-state
* aem-manifest-hash
* aem-manifest-url

---

## Architecture Overview

          ┌────────────────────────────┐
          │        Editor (UI)         │
          │        (ui.js)             │
          └────────────┬───────────────┘
                       │
                       ▼
          ┌────────────────────────────┐
          │  Canonical Manifest Layer  │
          │       (manifest.js)        │
          │                            │
          │  - create manifest         │
          │  - hash                    │
          │  - sign                    │
          │  - verify                  │
          └────────────┬───────────────┘
                       │
                       ▼
          ┌────────────────────────────┐
          │  Watermark / Image Layer   │
          │      (watermark.js)        │
          │                            │
          │  - render visible mark     │
          │  - embed hidden payload    │
          │  - apply edits             │
          └────────────┬───────────────┘
                       │
                       ▼
          ┌────────────────────────────┐
          │        Export Package      │
          │                            |
          │  Core:                     |
          │  - image (PNG)             │
          │  - manifest (JSON)         | 
          |                            |
          |  Optional transport:       |
          │  aem_package.json (bundle) |
          └────────────┬───────────────┘
                       │
                       ▼
          ┌────────────────────────────┐
          │        Verifier            │
          │                            │
          │  - check signature         │
          │  - read watermark          │
          │  - compare hashes          │
          └────────────────────────────┘
          
**Canonical manifest is signed.  
Everything else is derived.**

Transport formats (e.g. aem_package.json) are not part of the core protocol.
They are implementation-specific containers.

Only the stable provenance data is signed.  
The image, watermark, and UI are generated from that data and are not part of the signature.

## Overview

The prototype consists of:

- browser-based editor
- built-in verifier
- manifest + watermark system

---

## Core Design

The system is split into two layers:

### 1. Canonical signed manifest
- stable
- deterministic
- signed

### 2. Derived export layer
- rendered image
- hidden watermark
- UI metadata

---

## Why this matters

Earlier versions mixed both layers.

This caused:

- circular dependencies
- unstable hashes
- verification failures

---

## Final Architecture Flow

### Step 1 — Create canonical manifest
- collect provenance fields
- compute payload_canvas_hash

### Step 2 — Sign manifest
- hash canonical body
- create signature

### Step 3 — Derive export data
- generate hidden watermark
- render visible watermark
- compute exported image hash

### Step 4 — Package
- image
- manifest
- metadata

---

## Key Principle

> The manifest is the source of truth.  
> The image proves linkage to it.

---

## Verification Flow

1. load package
2. verify signature
3. extract hidden watermark
4. compare manifest hash
5. validate image consistency
6. output state

---

## Trust Model (current)

- browser-held signing key
- no central authority
- demonstrative trust only

---

## Trust Model (future)

A stronger system would include:

- backend signing service
- secure key management
- generator integration
- verifiable origin claims

---

## Known Weaknesses

- browser trust boundary
- simple watermarking
- no resistance to advanced tampering
- recent modularization (watch for wiring bugs)

---

## Purpose

This architecture demonstrates:

- clean trust separation
- provenance modeling
- UX patterns for AI content


