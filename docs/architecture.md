# AIM Protocol — Architecture Notes

This file describes the intended shape of the prototype and the likely path toward a more realistic implementation.

## Current prototype shape

A browser-based prototype can reasonably demonstrate:

- visible watermark states
- hover reveal behavior
- lightweight manifests
- simple signature flows
- local verifier UI

That is enough to explore the concept.

## Suggested real architecture

For a more serious integration:

```text
React frontend
   ↓
Your backend (origin authority / editor API / verifier)
   ↓
AI generation provider
```

This matters because the trust boundary should live in the backend, not in the browser.

## Why React is still useful

React is a good fit for:

- prompt UI
- image gallery / asset view
- editor UI
- state visualization
- hover-reveal watermark experience
- verifier screens

React is **not** the best place for:

- origin signing
- secret keys
- provider credentials
- trusted receipt validation

## Example service split

### Frontend
- image generation form
- upload/import form
- viewer
- editor
- verifier

### Backend
- `POST /generate`
- `POST /import`
- `POST /edit`
- `POST /verify`

### Internal backend modules
- provider client
- signing service
- manifest builder
- watermark embed/extract
- transition validator

## Make / automation note

Tools like Make can be useful around the system for:

- notifications
- intake automation
- partner workflows
- dashboards
- operational glue

They are less suitable as the deepest trust boundary.

## Practical next step

If this prototype were taken further, the cleanest next iteration would likely be:

- React frontend
- small backend
- explicit split between `Generate AI image` and `Upload external image`
- AI origin minted only by backend
- uploaded files always start as `EXT`
