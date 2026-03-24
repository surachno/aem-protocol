# AEM Protocol — Partner Pitch
The image shows the result. The manifest proves how it got there.

## Summary

AEM Protocol is a lightweight system for tracking how AI-generated images evolve over time.

It combines:
- visible edit states
- hidden watermarking
- signed provenance

---

## The core idea

> The image shows the result.  
> The manifest proves how it got there.

AEM separates:
- what users **see**
- from what systems can **verify**

---

## Why it matters

AI-generated content currently lacks:

- transparent edit history  
- clear origin signals  
- understandable trust indicators  

This creates confusion for:
- users
- platforms
- marketplaces

---

## A simple model

AEM introduces a minimal, human-readable state system:

| State | Meaning |
|------|--------|
| AI·0–9 | AI origin + verified edit count |
| EXT | External origin |
| X | Broken or unverifiable provenance |

---

## What makes AEM different

### 1. Visible + verifiable
- watermark is human-readable
- backed by signed metadata

### 2. Tracks evolution, not just origin
- focuses on **how content changes over time**
- not just “AI vs not AI”

### 3. Clear trust states
- valid (`AI`, `EXT`)
- broken (`X`)
- no ambiguity

### 4. Strict architecture
- canonical manifest is signed
- image + watermark are derived
- avoids circular dependencies

---

## Example integration

### Generators
- produce `AI·0`
- optionally sign origin

### Editors
- increment edit count (`AI·1 → AI·2`)
- sign new manifest

### External uploads
- marked as `EXT`
- no false AI claims

### Untrusted edits
- chain breaks → `X`

---

## What the prototype demonstrates

- working editor + verifier loop
- tamper detection
- metadata-only updates
- clear UX for provenance

---

## What is not included (yet)

- backend trust authority
- secure key infrastructure
- generator-issued signatures
- robust watermarking

---

## Where this fits

AEM can act as:

- a **UX layer** for provenance  
- a **lightweight protocol** for tracking edits  
- a **bridge** between creators, tools, and platforms  

---

## Opportunity for partners

Platforms can:

- increase transparency without heavy UX
- provide users with understandable trust signals
- differentiate with responsible AI tooling

---

## Closing idea

> AEM is not about proving absolute truth —  
> it is about making provenance visible, structured, and understandable.
