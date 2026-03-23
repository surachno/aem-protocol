# Contributing to AIM Protocol

Hi 👋 — thanks for your interest in contributing.

This repository is a prototype, and it is **not actively maintained**.  
That said, thoughtful contributions are still welcome.

## First, expectations

Please treat this project as:

- experimental
- incomplete
- exploratory
- shared in good faith, but without support guarantees

That means:

- responses may be slow or absent
- not every issue will be answered
- not every pull request will be reviewed or merged

## Good contributions

Helpful contributions include:

- documentation improvements
- clearer wording
- cleanup or readability improvements
- small bug fixes
- verifier clarity
- protocol notes
- examples that stay aligned with the current trust model

## Changes that need extra care

Please open an issue first if you want to change anything related to:

- the state model (`AI·0–9`, `EXT`, `X`)
- origin minting rules
- verification logic
- manifest schema
- signer roles
- watermark behavior
- anti-abuse guarantees

These parts are the core of the idea.

## Important boundaries

This project should **not** drift into a system that silently weakens trust.

Please do **not** introduce features that allow:

- uploaded images to become `AI·0`
- editors to mint AI origin
- broken `X` states to be “restored” into trusted numeric states
- verification bypasses
- fake trust for convenience

If a contribution makes the protocol easier but less honest, it is probably not a good fit.

## Coding style

Nothing fancy is required. Just aim for:

- clarity over cleverness
- small functions
- comments that explain **why**
- explicit behavior around trust-related logic

Example:

```js
// Prevent external images from claiming AI origin
if (prevState === "EXT" && nextState.startsWith("AI")) {
  throw new Error("Invalid transition: EXT cannot become AI-origin");
}
```

## Legal / ownership note

By contributing, you confirm that:

- you wrote the code or text yourself
- you have the right to contribute it
- it does not include confidential, proprietary, or employer-restricted material

## Final note

Honestly, if this repository helps spark better ideas, cleaner implementations, or thoughtful forks, that’s already a win.

Thanks for spending time on it.
