# AEM Protocol — Prototype Spec

## Overview

AEM Protocol (AI Edit Mark) is a prototype system for tracking how AI-generated images evolve over time.

Each asset combines:
- a visible mark (AI·0 → AI·9, EXT, X)
- a hidden watermark
- a signed manifest

---

## State Model

The visible state is one of:

- `AI·0` → `AI·9`
- `EXT`
- `X`

### AI states
- AI-generated origin
- verified edit count

### EXT
- external origin
- no AI-origin claim
- chain can still be valid

### X
- broken or unverifiable provenance

---

## Canonical Manifest

The system uses a **canonical signed manifest**.

### Signed fields (core provenance)

- asset_id
- origin_type
- edit_count_verified
- visible_state
- chain_status
- action_type
- payload_canvas_hash
- prev_manifest_hash
- timestamps
- public_key_jwk

### Important rule

> Only stable provenance fields are signed.

---

## Derived Export Fields (NOT signed)

These are intentionally excluded from signing:

- hidden_watermark
- exported_canvas_hash
- rendered_at
- viewer_embed
- visible_mark (UI label)

---

## Design Lesson

Earlier versions mixed export fields into the signed manifest, causing:

- `signature_invalid`
- `hidden_manifest_hash_mismatch`

### Final rule

> Separate **canonical manifest** from **export layer**.

---

## Hidden Watermark

Encodes:

- protocol version
- visible state
- asset_id (short)
- manifest_hash (short)

Purpose:
- link image → manifest

---

## Verification

Verifier checks:

1. signature validity (canonical manifest)
2. hidden watermark consistency
3. exported image consistency

Failure → `X`

---

## Metadata-Only Updates

- do not change pixels
- do not increment edit count
- create a new signed manifest

---

## Tamper Resistance

Any unsigned modification to the manifest:

→ breaks signature  
→ results in `X`

---

## Limitations

- browser-based signing
- no external trust authority
- lightweight watermarking
- not adversarially robust

---

## Purpose

AEM Protocol is a **prototype model** for:
- provenance UX
- edit tracking
- AI labeling

---

## Transport and storage

AEM Protocol is transport-agnostic.

The core protocol consists of:

* a canonical manifest
* an associated image

These may be transported or stored in different ways:

* separate files (`image.png` + `manifest.json`)
* bundled file (`aem_package.json`)
* API responses
* object storage systems (S3-compatible)

The protocol itself does not depend on any specific transport format.

