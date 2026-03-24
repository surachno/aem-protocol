# AEM Package Format v1

## Purpose

AEM Package Format is a transport format for bundling AEM-related data into a single file.

It is a convenience container, not the protocol itself.

The core protocol consists of:
- the image
- the canonical manifest

The package format simply wraps these together.

---

## Design principle

> AEM Protocol defines the provenance model.  
> AEM Package Format defines one way to transport it.

---

## File type

Recommended filename:

- `aem_package.json`

---

## Minimum structure

```json
{
  "package_version": 1,
  "manifest": { ... },
  "image_data_url": "data:image/png;base64,..."
}
