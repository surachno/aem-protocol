# AEM Protocol — LimeWire (LMWR) Partner Pitch

> The image shows the result. The manifest proves how it got there.

## Summary

AEM Protocol is a lightweight system for tracking how AI-generated images evolve over time.

It combines:
- visible edit states
- signed provenance
- simple trust signals

It is designed for platforms where **creation, remixing, ownership, and storage** all matter.

---

## Why this matters for LimeWire

The LimeWire ecosystem, including the LimeWire Network, sits at the intersection of:

- AI content creation
- creator monetization
- digital ownership
- object storage infrastructure

That combination is powerful, but it creates new questions:

- Was this asset AI-generated here, or uploaded from elsewhere?
- How many trusted edits were made after creation?
- Is the provenance chain still intact?
- How can buyers and users see that quickly?

AEM Protocol is designed to make those answers visible and verifiable.

---

## The core idea

> The image shows the result.  
> The manifest proves how it got there.

AEM separates:
- what users **see**
- from what platforms can **verify**

This is important because provenance should not depend only on UI labels or pixels.  
It should be anchored in a canonical manifest, then surfaced clearly in the interface.

---

## What AEM adds to LimeWire

### 1. Visible provenance for users

Every image carries a simple, readable state:

| State | Meaning |
|------|--------|
| AI·0–9 | AI origin + verified edit count |
| EXT | External origin |
| X | Broken provenance |

This gives buyers and users immediate context without requiring deep technical inspection.

---

### 2. Native support for remix culture

AI creation is iterative.

AEM tracks:
- how many trusted edits were made
- whether the chain is still intact
- whether the asset began inside a trusted AI generation path or entered externally

This aligns directly with:
- remixing
- prompt iteration
- collaborative creation
- marketplace reuse

---

### 3. Protection against misrepresentation

Without AEM:
- users can claim “AI-generated” falsely
- external images can be re-uploaded as if they originated inside the platform

With AEM:
- trusted generated assets begin at `AI·0`
- external uploads become `EXT`
- unverifiable changes become `X`

That reduces abuse without needing a heavy-handed moderation experience.

---

### 4. Lightweight, UX-first approach

Unlike heavier provenance systems:

- no complex user flow is required
- no expert reading is required
- the signal is visible on the asset itself
- verification still exists behind the scenes

This makes provenance more usable in creator-facing products.

---

## Storage and SDK alignment

AEM Protocol fits naturally into LimeWire's S3-compatible storage direction.

### The important shift

AEM should not be thought of primarily as:
- a single bundled file format

It should be thought of as:
- a provenance layer on top of **image objects + manifest objects**

---

## Object-based model

In a LimeWire-style storage setup:

```text
images/<asset_id>.png
manifests/<asset_id>.json
```

Optional metadata on the image object could include:

- `aem-asset-id`
- `aem-state`
- `aem-manifest-hash`
- `aem-manifest-url`

This makes AEM a natural fit for S3-compatible storage systems.

---

## Why this matters

This model avoids:

- large bundled payloads
- base64-heavy transport as the primary format
- tight coupling between verification and a demo-specific wrapper file

And it enables:

- scalable storage
- API-based workflows
- cleaner SDK integration
- easier marketplace and NFT linking

---

## Web3 alignment

AEM also fits naturally into a Web3 stack.

### Off-chain (AEM)
- manifest
- watermark
- edit history
- verification logic

### On-chain (optional)
- ownership
- minting
- attribution
- royalty logic
- manifest hash anchoring

---

## Possible connection

- hash of canonical AEM manifest → stored on-chain
- NFT metadata references:
  - asset_id
  - manifest_hash
  - manifest location
- provenance becomes visible in the UI and portable across systems

---

## Example flow in LimeWire

### 1. AI generation
- user creates image
- asset begins as `AI·0`
- image is stored as an object
- canonical manifest is created and signed

### 2. Editing / remixing
- edits increase state → `AI·1`, `AI·2`, etc.
- each trusted edit creates a new manifest
- image object and manifest remain linked

### 3. Uploading external content
- external upload becomes `EXT`
- no false AI-origin claim is made

### 4. Marketplace listing
- buyer sees:
  - AI vs EXT
  - edit depth
  - trust state

### 5. Tampering
- broken chain → `X`
- visible and verifiable

---

## What this prototype demonstrates

The current prototype demonstrates:

- a working editor + verifier loop
- visible + hidden watermark linkage
- tamper detection
- metadata-only updates
- a clear AI / EXT / X state model

---

## What is not included (yet)

The current prototype does **not** include:

- backend signing authority
- generator-issued origin signatures
- strong watermark robustness
- production key management
- direct LimeWire SDK integration
- S3 object metadata implementation
- on-chain integration

---

## Why this is valuable

AEM gives LimeWire:

- **clear AI provenance UX**
- **better buyer trust**
- **lower moderation burden**
- **alignment with remix culture**
- **a provenance layer that fits object storage**

---

## Strategic opportunity

LimeWire could:

- integrate AEM into its AI creation flow
- display AEM states in the marketplace
- store images and manifests as linked objects
- connect manifest hashes to NFT metadata
- position itself as a **transparent AI + storage platform**

---

## Closing idea

> AEM is not about proving absolute truth —  
> it is about making creation history visible, structured, and understandable.

For a creator economy platform, that visibility becomes value.
