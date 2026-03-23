# AIM Protocol (AEM-P) — Prototype Spec

This document describes the current prototype direction of AIM Protocol.

It is **not** a formal standard.  
It is a working concept document for a hobby/research prototype.

## Short summary

AIM Protocol tries to track how AI-generated images evolve over time.

The prototype combines:

- a visible state mark
- a hidden watermark signal
- a signed manifest
- a verifier flow

The goal is to express not only origin, but also what happened after origin.

## Public states

| State | Meaning |
|------|--------|
| `AI·0` | trusted AI origin, zero verified edits |
| `AI·1–8` | trusted AI origin, exact verified edit count |
| `AI·9` | trusted AI origin, 9+ verified edits |
| `EXT` | external import, not AI-origin certified |
| `X` | broken, tampered, or unverifiable |

## Core anti-abuse rule

`AI·0` must be **minted by a trusted origin authority**, not declared by a user.

That means:

- user uploads should start as `EXT`
- editors should not mint AI origin
- broken states should remain broken

## High-level roles

### Origin Authority
Trusted generation backend or generator integration.

Can:
- mint `AI·0`
- sign origin manifests

Cannot:
- pretend uploaded images were born as AI-origin

### Trusted Editor
Compatible editor flow.

Can:
- extend valid chains
- preserve `EXT`
- set `X` when trust breaks

Cannot:
- mint origin

### Verifier
Checks:

- signature validity
- state consistency
- chain integrity
- watermark consistency

## State transitions

Allowed:

```text
trusted generation -> AI·0
AI·0..8 + trusted edit -> next numeric state
AI·8 + trusted edit -> AI·9
AI·9 + trusted edit -> AI·9
EXT + trusted edit -> EXT
AI·0..9 + trust failure -> X
EXT + trust failure -> X
X + later action -> X
```

Forbidden:

```text
EXT -> AI·0
X -> AI·0
upload -> AI·0
editor -> AI·0
```

## Prototype manifest idea

A manifest may contain fields like:

```json
{
  "protocol_version": 4,
  "manifest_type": "origin | import | edit | broken",
  "signer_role": "origin_authority | trusted_editor",
  "asset_id": "uuid",
  "origin_type": "ai_generated | external_import",
  "state": "AI·0 | AI·1..9 | EXT | X",
  "edit_count_verified": 0,
  "chain_status": "valid | external | broken",
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601",
  "prev_manifest_hash": "hex | null",
  "manifest_hash": "hex"
}
```

## Trust boundaries

The browser UI is a good place for:

- image preview
- subtle watermark display
- hover reveal
- editor controls
- verifier display

A backend is the right place for:

- generation receipts
- origin minting
- signing
- anti-abuse rules
- source-of-truth verification

## Status of this spec

This document is descriptive, not normative.

It exists so the repo has a clear direction and so future readers can understand the intent behind the prototype.
