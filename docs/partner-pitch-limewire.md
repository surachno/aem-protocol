# AEM Protocol — LimeWire Partner Pitch
The image shows the result. The manifest proves how it got there.

## Summary

AEM Protocol is a lightweight system for tracking how AI-generated images evolve over time.

It introduces:
- visible edit states
- signed provenance
- simple trust signals

Designed for platforms where **creation, remixing, and ownership matter**.

---

## Why this matters for LimeWire

LimeWire sits at the intersection of:

- AI content creation  
- creator monetization  
- digital ownership  

But AI content introduces new challenges:

- unclear origin (AI vs external)
- no visible edit history
- difficult trust signals for buyers
- easy misrepresentation

---

## The core idea

> The image shows the result.  
> The manifest proves how it got there.

AEM separates:
- what users **see**
- from what platforms can **verify**

---

## What AEM adds to LimeWire

### 1. Visible provenance for users

Every image carries a simple, readable state:

| State | Meaning |
|------|--------|
| AI·0–9 | AI origin + edit count |
| EXT | External origin |
| X | Broken provenance |

This gives buyers immediate context.

---

### 2. Native support for remix culture

AI creation is iterative.

AEM tracks:
- how many edits were made
- whether those edits were trusted
- whether the chain is intact

This aligns directly with:
- remixing
- prompt iteration
- collaborative creation

---

### 3. Protection against misrepresentation

Without AEM:
- users can claim “AI-generated” falsely
- external images can be re-uploaded as AI

With AEM:
- external uploads → `EXT`
- unverifiable edits → `X`

→ reduces abuse without heavy moderation

---

### 4. Lightweight, UX-first approach

Unlike heavy provenance systems:

- no complex UI required
- no deep inspection needed
- signal is **visible on the asset itself**

---

## Web3 alignment

AEM fits naturally into a Web3 stack:

### Off-chain (AEM)
- manifest
- watermark
- edit history

### On-chain (optional)
- ownership
- minting
- attribution
- royalty logic

---

### Possible connection

- hash of AEM manifest → stored on-chain
- NFT references:
  - asset_id
  - manifest_hash
- provenance becomes verifiable across systems

---

## Example flow in LimeWire

### 1. AI generation
- user creates image → `AI·0`
- manifest is created

### 2. Editing / remixing
- edits increase state → `AI·1`, `AI·2`
- each step signed

### 3. Uploading external content
- marked as `EXT`
- no false AI origin claim

### 4. Marketplace listing
- buyer sees:
  - AI vs EXT
  - edit depth
  - trust state

### 5. Tampering
- broken chain → `X`
- visible + verifiable

---

## What this prototype demonstrates

- working editor + verifier loop
- visible + hidden watermark linkage
- tamper detection
- clean state model

---

## What is not included (yet)

- backend signing authority
- generator-issued signatures
- strong watermark robustness
- on-chain integration

---

## Why this is valuable

AEM gives LimeWire:

- **clear AI provenance UX**
- **better buyer trust**
- **lower moderation burden**
- **alignment with remix culture**

---

## Strategic opportunity

LimeWire could:

- integrate AEM into its AI tools
- display AEM states in the marketplace
- connect manifests to NFTs
- position itself as a **transparent AI platform**

---

## Closing idea

> AEM is not about proving absolute truth —  
> it is about making creation history visible, structured, and meaningful.

In a creator economy, that visibility becomes value.
