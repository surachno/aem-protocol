# AEM Protocol — Partner Pitch

## Summary

AEM Protocol is a lightweight system for tracking how AI-generated images evolve over time.

It combines:
- visible edit states
- hidden watermarking
- signed provenance

---

## Why it matters

AI content lacks:
- transparent edit history
- clear origin signals
- trust indicators for users

AEM introduces a simple model:

| State | Meaning |
|------|--------|
| AI·0–9 | AI origin + edit count |
| EXT | External origin |
| X | Broken provenance |

---

## What makes AEM different

- human-readable watermark (not just invisible)
- edit evolution, not just origin
- strict verifier model
- separation of origin vs trust

---

## Example use cases

- AI image platforms
- creator tools
- marketplaces
- social media labeling

---

## Integration idea

- generators produce `AI·0`
- editors increment state
- external uploads → `EXT`
- broken edits → `X`

---

## What this prototype shows

- viable UX model
- working verification loop
- tamper detection
- metadata-only updates

---

## What is not included (yet)

- backend trust authority
- secure key management
- strong watermarking

---

## Opportunity

AEM can serve as:
- a design layer for provenance
- a standardization starting point
- a UX pattern for AI disclosure

---

## Closing idea

> AEM is not about proving truth —  
> it is about making provenance visible and structured.
