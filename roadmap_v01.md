## Roadmap (v0.1)

This project is intentionally small, but a few improvements are planned:

### 1. Stability

* reduce implicit cross-module dependencies
* make module boundaries clearer
* avoid regressions when refactoring

---

### 2. UX clarity

* add a simple guided flow (“Generate → Edit → Verify”)
* improve labeling (e.g. package vs manifest)
* make first-time use more intuitive

---

### 3. Storage model alignment

* better reflect object-based storage (S3-style)
* treat `aem_package.json` as a demo format only
* support image + manifest as separate inputs in verifier

---

### 4. Documentation

* clarify roles (generator, editor, verifier)
* expand integration examples
* refine terminology for non-developers

---

### 5. Optional future exploration

* API-based flow (instead of file-based)
* integration with AI generation tools
* stronger watermarking approaches

---

This roadmap is intentionally lightweight.

The goal is not to build a full system, but to explore a clear and usable model for AI provenance.
