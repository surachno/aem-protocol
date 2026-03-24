# AEM Protocol, Prototype — Test Manual

This manual describes how to test all core behaviors of the AEM demo UI.

---

## 1. Generated Image (AI Origin)

Steps
Click: New generated demo image → AI·0

Expected
- State becomes: AI·0
- Edit count: 0
- Chain status: valid

---

Purpose
Tests trusted origin creation.

## 2. Trusted Edits

Steps
Start from AI·0

Click any edit:
Grayscale / Invert / Brighten / Rotate / Crop

Expected
- State increments: AI·1, AI·2, …
- Edit count increases
- Chain remains valid

Purpose
Tests verified edit tracking.

---

## 3. External Import (EXT)

Steps
Upload an image via External import path

Expected
- State: EXT
- Chain status: external

Purpose
Prevents fake AI-origin claims.

---

## 4. Broken Chain (X)

Steps
Click: Force broken chain → X

Expected
- State: X
- Chain status: broken

Purpose
Simulates untrusted editing outside the system.

---

## 5. Hover Watermark

Steps
Move mouse over watermark (bottom-right)

Expected
- Subtle mark becomes bright
- Tooltip appears

Purpose
Tests human-visible watermark UX.

---

## 6. Export + Verify

Steps
Click: Download package
Go to Verifier mode
Load package

Expected
- Valid states:
  AI·n
  EXT
- Invalid/tampered:
  X

Purpose
Tests full pipeline.

---

## 7. Metadata Only (detailed description)

What it does

The Metadata Only button creates a new signed version of the asset without changing the image content.

Steps
Start from any state (e.g. AI·2 or EXT)
Click: Metadata only
Export package
Verify it

Expected behavior
- State stays the same
- → AI·2 remains AI·2
- → EXT remains EXT
- Edit count stays the same

Verification result:
→ ✅ still valid

What actually changes

Even though the image looks identical:
- Field	Changes
- updated_at	✔️
- manifest_hash	✔️
- signature	✔️
- hidden watermark	✔️
- exported image bytes	✔️ (slightly)

Key concept
👉 Metadata Only creates a new cryptographic version, not a visual edit

Why this matters

It allows:
- attribution updates
- licensing changes
- re-signing
- platform annotations

…without affecting the edit count.

Important developer lesson

This test validates:

“Can the system update provenance without altering visual edit history?”

And also confirms:
- canonical manifest remains valid
- signing boundary is stable
- hidden watermark stays consistent

Potential confusion

User expectation:
“Nothing changed”

Reality:
“A new signed version was created”

This is correct behavior.

Recommended test variations

Test A
AI·0 → Metadata Only → Verify
→ expect AI·0

Test B
EXT → Metadata Only → Verify
→ expect EXT

Test C (repeat)
Click Metadata Only multiple times
→ always same visible state
→ always valid verification

---

## 8. Tamper Test (detailed description)

What it does

The Tamper Test simulates:
“Someone modifies the manifest without access to the signing key”

Steps
Create a valid asset (e.g. AI·1)
In Tamper test textarea, enter:
{"visible_state":"AI·9"}
Click:
→ Send tampered package to verifier

Expected result
❌ Verification failed → X

Reason:
signature_invalid
OR
hidden_manifest_hash_mismatch

Why it fails

Because:
original manifest was signed
you changed data
signature no longer matches

👉 verifier detects inconsistency

What this proves

This is the core security guarantee:
“You cannot change claims without breaking verification”

Most relevant tamper examples
1. Fake AI level
{"visible_state":"AI·9"}
👉 Prevents fake “high edit count” claims

2. Reset edit count
{"edit_count_verified":0}
👉 Prevents hiding edits

3. Fake origin
{"origin_type":"ai_generated"}
👉 Prevents turning EXT into AI

4. Fake chain status
{"chain_status":"valid"}
👉 Prevents hiding broken chain

5. Fake asset ID
{"asset_id":"fake123"}
👉 Prevents identity spoofing

What verifier checks
- signature validity
- hidden watermark consistency
- manifest consistency
- rendered image hash

If any fail → X

Important nuance

Tamper test:
- modifies manifest only
- does NOT modify:
  image
  hidden watermark

This creates mismatch → detected

Developer takeaway

This test validates:
- signature enforcement
- anti-forgery protection
- canonical manifest integrity

separation of:
- signed data
- derived/export data

Failure modes you may see
| Reason                          | Meaning            |
| ------------------------------- | ------------------ |
| `signature_invalid`             | manifest modified  |
| `hidden_manifest_hash_mismatch` | watermark mismatch |
| `rendered_hash_mismatch`        | image altered      |


All correctly result in → X

| Test          | Result                  |
| ------------- | ----------------------- |
| Generated     | AI·0                    |
| Trusted edit  | AI·n                    |
| External      | EXT                     |
| Metadata only | same state, new version |
| Tamper        | X                       |
| Broken chain  | X                       |
| Verify        | matches expected state  |
