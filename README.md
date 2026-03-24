# AEM Protocol

Hi — and welcome 👋

This repository is a small prototype exploring a simple idea:

> What if AI-generated images could carry a visible, human-readable history of how they’ve been edited?

That’s what AEM Protocol is about.

AEM stands for **AI Edit Mark**.

## What this is

This repo contains an experimental prototype for tracking how AI images evolve over time.

Instead of only asking:

> “Was this image AI-generated?”

AEM tries to also answer:

> “What happened to this image after it was created?”

The prototype uses a simple state system:

- `AI·0` → original AI-generated image
- `AI·1–8` → verified edits
- `AI·9` → many verified edits
- `EXT` → external image (not AI-origin certified)
- `X` → broken or unverifiable provenance

## What’s in here

This project currently includes:

- a browser-based prototype
- a subtle visible watermark concept
- a hover-to-reveal viewer effect
- a lightweight manifest format
- a simple verifier flow
- protocol notes and repo documentation

It is intentionally lightweight and easy to inspect.

## Project status

This is a **prototype / exploration project**.

Please assume:

- it is **not production-ready**
- it is **not actively maintained**
- it comes **with no guarantees**
- you use it **at your own risk**

I’m sharing it as:

- a concept
- a conversation starter
- a reference point for future experiments

## AI assistance and human review

This repository was built with substantial AI assistance and human review.

The concept, framing, state model, documentation, and review decisions are human-directed.  
The implementation was AI-assisted and should be treated accordingly: useful for exploration, but not something to trust blindly.

If you use or build on this project, please review the code yourself and make your own decisions about correctness, safety, and suitability.

## Important limitations

This prototype does **not** implement:

- secure key management
- production-grade watermarking
- strong attack resistance
- cross-platform trust infrastructure
- hardened verification guarantees
- legal, compliance, or policy-grade provenance

So please don’t rely on it for anything critical.

## Running it locally

If the prototype uses plain browser files, opening `index.html` may be enough.

For example:

```bash
open index.html
```

Some versions of the demo load React from a CDN, so an internet connection may still be needed in the browser.

## Why I made this

AI images are everywhere now, and they often change a lot after being created.

I got curious about whether there could be a simple, human-readable way to show:

- where an image started
- whether it stayed in a trusted edit flow
- and when that trust broke

This repo is one attempt at exploring that idea.

## License

MIT.

That means you are generally free to:

- use the code
- modify it
- fork it
- build on it

But it also means:

> this project is provided “as is”, without warranty.

See `LICENSE` and `DISCLAIMER.md`.

## Contributing

This project is not actively maintained, but thoughtful contributions are still welcome.

Please read:

- `CONTRIBUTING.md`
- `docs/spec.md`

before making bigger changes.

## Big picture

If this idea ever grows, I imagine something like:

> a shared way to track how AI media evolves over time

But for now, this is just a small prototype.

Thanks for taking a look.

