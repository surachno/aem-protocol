# 1. AEM Package Format v1

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

## Role of the package format

The AEM package (`aem_package.json`) is a convenience transport format.

It bundles:

* image (as data URL)
* manifest
* optional metadata

However:

> It is not the preferred format for scalable or production systems.

---

## S3-compatible storage profile

In object storage systems:

* the image is stored as a binary object
* the manifest is stored as a separate JSON object
* object metadata may include lightweight AEM fields

Example:

```
images/<asset_id>.png
manifests/<asset_id>.json
```

This is the preferred model for integrations (e.g. LimeWire SDK).

---

## File type package (optional)

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
```

### Fields
```package_version```
Integer version of the package container format.
Example
```json
"package_version": 1
```

```manifest```
The canonical AEM manifest.
This is the main source of truth for:
- visible state
- origin type
- chain status
- edit count
- signature

```image_data_url```
A PNG image encoded as a data URL.
This image may include:
- visible watermark
- hidden watermark
  
### Optional fields
These are allowed as convenience fields, but are not required by the protocol:
```json
{
  "package_version": 1,
  "manifest": { ... },
  "image_data_url": "data:image/png;base64,...",
  "notes": "optional human-readable notes",
  "exported_by": "tool-name",
  "exported_at": "2026-01-01T12:00:00Z"
}
```

### Important rule
The package file is not the trust boundary.
The trust boundary is:
- the canonical manifest signature
- consistency between manifest and image

### Verification rule
A verifier should:
- read the manifest
- verify the canonical signature
- decode the image
- extract hidden watermark
- compare manifest/image consistency
If any required check fails:
- return X

### What is not required
AEM Package Format does not require:
- blockchain
- NFT metadata
- backend APIs
- a specific storage provider

### Why this exists
This format is useful for:
- browser demos
- API exchange
- developer testing
- single-file export/import

# 2. Alternative transports for AEM

This is where your project gets more flexible and future-proof.

---

## A. Separate files

Instead of one package file:

- `image.png`
- `manifest.json`

This is the cleanest conceptual form.

### Good for
- developer workflows
- open tooling
- manual inspection

### Tradeoff
- two files are easier to separate accidentally

---

## B. Single JSON bundle
This is your current `aem_package.json`.

### Good for
- browser demos
- import/export UX
- sending one file around

### Tradeoff
- image is embedded as a data URL, which is less elegant for larger assets

---

## C. API transport
Instead of files, a server returns:
```json
{
  "manifest": { ... },
  "image_url": "https://...",
  "package_url": "https://..."
}
```
Good for:
- platforms
- backend workflows
- generator/editor integrations

Tradeoff:
- needs infrastructure

---

## D. NFT / Web3 metadata link

You do not put the whole AEM package on-chain usually.

Instead, the NFT metadata can reference:
- asset_id
- manifest_hash
- manifest_url
- image_url

Example conceptual NFT metadata:
```json
{
  "name": "AEM Asset",
  "image": "ipfs://.../image.png",
  "external_url": "https://.../verify/asset_id",
  "properties": {
    "aem_asset_id": "aem_8f3a1c2d9b7e",
    "aem_manifest_hash": "abc123...",
    "aem_state": "AI·2",
    "aem_manifest_url": "ipfs://.../manifest.json"
  }
}
```

Good for:
- marketplaces
- ownership linking
- collector-facing provenance

Tradeoff:
- on-chain data should stay minimal

---

## E. Embedded image metadata

In the future, some AEM data could be stored in image metadata chunks.

Good for:
- tighter file coupling
- fewer separate files

Tradeoff:
- metadata may be stripped by platforms
- interoperability gets trickier

---

## F. Verification endpoint

A platform could expose:
- POST /verify
- GET /assets/:id/manifest

Good for:
- partner integrations
- public verification pages
- marketplaces

Tradeoff:
- requires backend trust model

