/**
 * AEM Protocol — manifest.js
 * ------------------------------------------------
 * Real split module:
 * - protocol constants
 * - canonical manifest helpers
 * - hashing / signing helpers
 * - verifier logic
 *
 * This split makes the signing boundary easier to review.
 */
(function (global) {
  /* =========================================================
     PROTOTYPE CONSTANTS
     ========================================================= */

  // Increase this when the package / manifest format changes meaningfully.
  const PROTOCOL_VERSION = 4;

  // Local storage key used for the prototype signing key.
  const STORAGE_KEY = "aem_p_hover_ext_signing_key_jwk";

  // Prefix used to identify hidden watermark payloads.
  const MAGIC = "AEMWM4";

  // Public states used throughout the prototype.
  const STATE = {
    AI0: "AI·0",
    EXT: "EXT",
    X: "X",
  };

function uuidLike() {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    return [...buf]
      .map((b, i) => (i === 4 || i === 6 || i === 8 || i === 10 ? "-" : "") + b.toString(16).padStart(2, "0"))
      .join("");
  }

function nowIso() {
    return new Date().toISOString();
  }

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

function stripManifestForSigning(m) {
    const clone = JSON.parse(JSON.stringify(m));

    /**
     * IMPORTANT:
     * The canonical signed body must not include self-referential hash fields.
     *
     * Why:
     * - manifest_hash cannot be part of the body used to compute manifest_hash
     * - manifest_hash_short is derived from manifest_hash
     * - visible_mark is a presentation/export convenience field
     *
     * If these are left in, the signature boundary drifts and normal exports can
     * fail verification with signature_invalid.
     */
    delete clone.signature_b64;
    delete clone.manifest_hash;
    delete clone.manifest_hash_short;
    delete clone.visible_mark;
    delete clone.hidden_watermark;
    delete clone.exported_canvas_hash;
    delete clone.rendered_at;
    delete clone.viewer_embed;
    delete clone.hover_reveal_enabled;
    return clone;
  }

async function sha256Hex(text) {
    const enc = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

function base64ToUint8Array(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

function aiStateFromCount(editCount) {
    if (editCount <= 0) return STATE.AI0;
    if (editCount >= 9) return "AI·9";
    return "AI·" + String(editCount);
  }

function isAIState(state) {
    return /^AI·[0-9]$/.test(state);
  }

function deriveNextTrustedState(currentState, currentEditCount) {
    if (currentState === STATE.EXT) {
      return { visibleState: STATE.EXT, editCountVerified: currentEditCount };
    }
    if (currentState === STATE.X) {
      return { visibleState: STATE.X, editCountVerified: currentEditCount };
    }

    const nextCount = currentEditCount + 1;
    return {
      visibleState: aiStateFromCount(nextCount),
      editCountVerified: nextCount,
    };
  }

function canvasToDataUrl(canvas) {
    return canvas.toDataURL("image/png");
  }

async function canvasHash(canvas) {
    return sha256Hex(canvasToDataUrl(canvas));
  }

async function getOrCreateSigningKey() {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
      return crypto.subtle.importKey(
        "jwk",
        JSON.parse(stored),
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign"]
      );
    }

    const pair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );

    const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jwk));
    return pair.privateKey;
  }

async function getPublicJwk(privateKey) {
    const jwk = await crypto.subtle.exportKey("jwk", privateKey);
    delete jwk.d;
    jwk.key_ops = ["verify"];
    return jwk;
  }

async function signManifest(manifest, privateKey) {
    const payload = JSON.stringify(stripManifestForSigning(manifest));
    const sig = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      new TextEncoder().encode(payload)
    );
    return arrayBufferToBase64(sig);
  }

async function verifyManifestSignature(manifest) {
    if (!manifest.public_key_jwk || !manifest.signature_b64) return false;

    const publicKey = await crypto.subtle.importKey(
      "jwk",
      manifest.public_key_jwk,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["verify"]
    );

    return crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      base64ToUint8Array(manifest.signature_b64),
      new TextEncoder().encode(JSON.stringify(stripManifestForSigning(manifest)))
    );
  }

async function finalizeManifest(manifest) {
    const privateKey = await getOrCreateSigningKey();
    const finalized = JSON.parse(JSON.stringify(manifest));
    finalized.manifest_hash = await sha256Hex(JSON.stringify(stripManifestForSigning(finalized)));
    finalized.manifest_hash_short = finalized.manifest_hash.slice(0, 16);
    finalized.signature_b64 = await signManifest(finalized, privateKey);
    return finalized;
  }

async function verifyImportedPackage(pkg) {
    /**
     * Cross-module dependency note:
     * verifyImportedPackage needs extractHiddenWatermark(), which now lives in
     * watermark.js after the split. In the monolithic file this was implicit;
     * after modularization we must reference it explicitly.
     */
    const { extractHiddenWatermark } = global.AEMWatermark;
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = pkg.image_data_url;
    });

    const rendered = document.createElement("canvas");
    rendered.width = img.width;
    rendered.height = img.height;
    rendered.getContext("2d").drawImage(img, 0, 0);

    const reasons = [];
    const manifest = pkg.manifest;

    const signatureOk = await verifyManifestSignature(manifest);
    if (!signatureOk) reasons.push("signature_invalid");

    const hidden = extractHiddenWatermark(rendered);
    if (!hidden) {
      reasons.push("hidden_watermark_missing");
    } else {
      if (String(hidden.state_code) !== String(manifest.visible_state)) reasons.push("hidden_state_mismatch");
      if (hidden.manifest_hash_short !== manifest.manifest_hash_short) reasons.push("hidden_manifest_hash_mismatch");
      if (hidden.asset_id_short !== manifest.asset_id.slice(0, 12)) reasons.push("hidden_asset_id_mismatch");
      if (hidden.manifest_type !== manifest.manifest_type) reasons.push("hidden_manifest_type_mismatch");
    }

    const exportedHash = await canvasHash(rendered);
    if (exportedHash !== manifest.exported_canvas_hash) reasons.push("rendered_hash_mismatch");

    const ok = reasons.length === 0 && manifest.chain_status !== "broken";

    return {
      ok,
      reasons,
      visible_state: ok ? manifest.visible_state : STATE.X,
      chain_status: ok ? manifest.chain_status : "broken",
      manifest,
    };
  }

async function makeSignedManifest({
    prevManifest,
    sourceLabel,
    actionType,
    editCountVerified,
    visibleState,
    chainStatus,
    canvas,
    breakReason,
    viewerStyle,
    manifestType,
    signerRole,
    originType,
  }) {
    const privateKey = await getOrCreateSigningKey();
    const publicJwk = await getPublicJwk(privateKey);
    const payloadCanvasHash = await canvasHash(canvas);

    return {
      protocol_version: PROTOCOL_VERSION,
      asset_id: prevManifest ? prevManifest.asset_id : uuidLike(),
      manifest_type: manifestType,
      signer_role: signerRole,
      origin_type: originType,
      source_label: sourceLabel || (prevManifest && prevManifest.source_label) || "demo",
      tool_id: "aem_p.demo",
      tool_version: "0.4.1",
      created_at: prevManifest ? prevManifest.created_at : nowIso(),
      updated_at: nowIso(),
      action_type: actionType,
      edit_count_verified: editCountVerified,
      visible_state: visibleState,
      chain_status: chainStatus,
      prev_manifest_hash: prevManifest ? prevManifest.manifest_hash : null,
      break_reason: breakReason || null,
      payload_canvas_hash: payloadCanvasHash,
      viewer_style: viewerStyle,
      public_key_jwk: publicJwk,
      signature_b64: null,
    };
  }



  global.AEMManifest = {
    PROTOCOL_VERSION,
    STORAGE_KEY,
    MAGIC,
    STATE,
    uuidLike,
    nowIso,
    clamp,
    stripManifestForSigning,
    sha256Hex,
    arrayBufferToBase64,
    base64ToUint8Array,
    downloadBlob,
    aiStateFromCount,
    isAIState,
    deriveNextTrustedState,
    canvasToDataUrl,
    canvasHash,
    getOrCreateSigningKey,
    getPublicJwk,
    signManifest,
    verifyManifestSignature,
    finalizeManifest,
    makeSignedManifest,
    verifyImportedPackage
  };
})(window);
