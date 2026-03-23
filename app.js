/**
 * AEM-P — EXT-aware Hover Demo
 * ------------------------------------------------
 * This React app demonstrates a prototype provenance flow for images.
 *
 * MAIN IDEAS SHOWN HERE
 * 1. Two different creation paths:
 *    - generated demo image -> AI·0
 *    - uploaded external image -> EXT
 * 2. Verified edits:
 *    - AI·0..8 -> next number
 *    - AI·9 stays AI·9
 *    - EXT stays EXT
 *    - X stays X
 * 3. A subtle visible watermark:
 *    - faint by default
 *    - bright on hover
 * 4. A hidden watermark in pixel data
 * 5. A signed manifest
 * 6. A verifier mode
 *
 * IMPORTANT PROTOTYPE NOTES
 * - This is not production-ready
 * - Browser-side signing is convenient for demos but not ideal for real trust boundaries
 * - The hidden watermark is lightweight and not robust against aggressive changes
 */

(function () {
  const e = React.createElement;

  /* =========================================================
     PROTOTYPE CONSTANTS
     ========================================================= */

  // Increase this when the package / manifest format changes meaningfully.
  const PROTOCOL_VERSION = 4;

  // Local storage key used for the prototype signing key.
  const STORAGE_KEY = "aem_p_hover_ext_signing_key_jwk";

  // Prefix used to identify hidden watermark payloads.
  const MAGIC = "AEMPWM4";

  // Public states used throughout the prototype.
  const STATE = {
    AI0: "AI·0",
    EXT: "EXT",
    X: "X",
  };

  /* =========================================================
     SMALL GENERIC HELPERS
     ========================================================= */

  /** Create a UUID-like identifier for prototype assets. */
  function uuidLike() {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    return [...buf]
      .map((b, i) => (i === 4 || i === 6 || i === 8 || i === 10 ? "-" : "") + b.toString(16).padStart(2, "0"))
      .join("");
  }

  /** Return an ISO timestamp string. */
  function nowIso() {
    return new Date().toISOString();
  }

  /** Clamp a numeric value between min and max. */
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  /**
   * Return the canonical manifest body used for hashing and signing.
   *
   * IMPORTANT DESIGN LESSON
   * -----------------------
   * Earlier prototype versions signed the manifest too late / too loosely:
   * fields such as hidden_watermark, viewer_embed, and exported image hash
   * were mixed into the signed body. That created circular dependencies:
   *
   * - hidden watermark wanted to store the manifest hash
   * - manifest hash changed when hidden_watermark was added
   * - exported image hash changed after rendering / embedding
   * - verifier then saw mismatches such as:
   *   - signature_invalid
   *   - hidden_manifest_hash_mismatch
   *
   * WHAT WE LEARNED
   * ---------------
   * A verifier only works reliably when there is one stable, canonical
   * manifest body. Everything derived later for export or UI display should
   * stay OUTSIDE that canonical signed boundary.
   *
   * DEVELOPER RULE
   * --------------
   * Only sign stable provenance fields.
   * Do NOT sign viewer-only or export-only convenience fields.
   *
   * Fields intentionally excluded from signing:
   * - signature_b64
   * - manifest_hash
   * - manifest_hash_short
   * - visible_mark
   * - hidden_watermark
   * - exported_canvas_hash
   * - rendered_at
   * - viewer_embed
   * - hover_reveal_enabled
   *
   * If you later add new fields, decide carefully whether they belong in:
   * 1. the canonical signed manifest, or
   * 2. the derived export/package layer
   */
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

  /** SHA-256 helper used for manifest and canvas hashing. */
  async function sha256Hex(text) {
    const enc = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /** Convert ArrayBuffer -> base64. Used for storing signatures. */
  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  /** Convert base64 -> Uint8Array. Used for verifying signatures. */
  function base64ToUint8Array(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /** Trigger a file download in the browser. */
  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  /* =========================================================
     STATE TRANSITION HELPERS
     ========================================================= */

  /**
   * Convert an internal AI edit count into the public AI state language.
   * 0 -> AI·0
   * 1..8 -> AI·1..AI·8
   * 9+ -> AI·9
   */
  function aiStateFromCount(editCount) {
    if (editCount <= 0) return STATE.AI0;
    if (editCount >= 9) return "AI·9";
    return "AI·" + String(editCount);
  }

  /** Return true when a state belongs to the AI numeric chain. */
  function isAIState(state) {
    return /^AI·[0-9]$/.test(state);
  }

  /**
   * Derive the next visible state after a trusted edit.
   *
   * Rules used here:
   * - AI chain increments up to AI·9
   * - EXT remains EXT
   * - X remains X
   */
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

  /* =========================================================
     WEBSITE EMBED SNIPPETS
     =========================================================
     These snippets are exported with the package so the same
     hover-reveal behavior can be recreated on a website.
     ========================================================= */

  /** CSS snippet for a simple website-side hover-reveal implementation. */
  function viewerCssSnippet() {
    return `.aemp-viewer { position: relative; display: inline-block; }
.aemp-viewer img { display: block; max-width: 100%; height: auto; }
.aemp-hover-mark {
  position: absolute; right: 18px; bottom: 18px; padding: 8px 10px;
  font: 700 12px/1 monospace; letter-spacing: .08em;
  color: rgba(255,255,255,.12); background: rgba(255,255,255,.04);
  image-rendering: pixelated; transition: all .18s ease;
}
.aemp-viewer:hover .aemp-hover-mark,.aemp-hover-mark:focus {
  color: rgba(255,255,255,.98); background: rgba(2,6,23,.86);
  box-shadow: 0 0 0 1px rgba(255,255,255,.35), 0 0 18px rgba(147,197,253,.28);
}`;
  }

  /** HTML snippet companion for the website-side hover reveal. */
  function viewerHtmlSnippet(stateCode) {
    return `<div class="aemp-viewer">
  <img src="your-image.png" alt="AEM-P image" />
  <div class="aemp-hover-mark" aria-label="AEM-P state ${stateCode}">${stateCode}</div>
</div>`;
  }

  /* =========================================================
     CANVAS / IMAGE HELPERS
     ========================================================= */

  /**
   * Create a built-in demo image.
   *
   * Main steps:
   * 1. Create a canvas
   * 2. Paint a gradient background
   * 3. Add decorative circles
   * 4. Add label text
   */
  function createDemoBaseCanvas() {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 768;

    const ctx = c.getContext("2d");

    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, "#312e81");
    g.addColorStop(0.5, "#0f766e");
    g.addColorStop(1, "#1d4ed8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);

    for (let i = 0; i < 20; i++) {
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = i % 2 ? "#ffffff" : "#7dd3fc";
      ctx.beginPath();
      ctx.arc(80 + i * 44, 120 + (i % 3) * 120, 28 + (i % 4) * 16, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.font = "bold 72px Arial";
    ctx.fillText("AEM-P DEMO IMAGE", 72, 640);

    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.font = "28px Arial";
    ctx.fillText("Generated inside the trusted demo path", 72, 684);

    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 3;
    ctx.strokeRect(52, 52, c.width - 104, c.height - 104);

    return c;
  }

  /** Make a visual copy of a canvas. */
  function copyCanvas(source) {
    const c = document.createElement("canvas");
    c.width = source.width;
    c.height = source.height;
    c.getContext("2d").drawImage(source, 0, 0);
    return c;
  }

  /** Turn an uploaded file into an Image object. */
  function imageFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = reject;
      img.src = url;
    });
  }

  /** Serialize a canvas as a PNG data URL. */
  function canvasToDataUrl(canvas) {
    return canvas.toDataURL("image/png");
  }

  /** Hash a canvas by hashing its PNG data URL. */
  async function canvasHash(canvas) {
    return sha256Hex(canvasToDataUrl(canvas));
  }

  /* =========================================================
     BROWSER-SIDE SIGNING HELPERS
     =========================================================
     Prototype only:
     - creates a local ECDSA key
     - stores it in localStorage
     - uses it to sign manifests
     ========================================================= */

  /** Get or create a local signing key. */
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

  /** Derive the public JWK from the local private key. */
  async function getPublicJwk(privateKey) {
    const jwk = await crypto.subtle.exportKey("jwk", privateKey);
    delete jwk.d;
    jwk.key_ops = ["verify"];
    return jwk;
  }

  /** Sign a manifest and return base64 signature text. */
  async function signManifest(manifest, privateKey) {
    const payload = JSON.stringify(stripManifestForSigning(manifest));
    const sig = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      new TextEncoder().encode(payload)
    );
    return arrayBufferToBase64(sig);
  }

  /** Verify a manifest signature using the public key stored in the manifest. */
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

  /**
   * Finalize the canonical manifest by hashing and signing it.
   *
   * IMPORTANT:
   * This function signs the canonical manifest only.
   * It does NOT sign export-time convenience fields because those fields are
   * intentionally excluded by stripManifestForSigning().
   *
   * WHY DEVELOPERS SHOULD CARE
   * --------------------------
   * If you move export-only fields OR self-referential hash fields back into
   * the signed body, the old verifier problems can come back:
   * - signature_invalid
   * - hidden_manifest_hash_mismatch
   *
   * So whenever you extend the manifest schema, ask:
   * "Is this a stable provenance field, or just a derived export/UI field?"
   */
  async function finalizeManifest(manifest) {
    const privateKey = await getOrCreateSigningKey();
    const finalized = JSON.parse(JSON.stringify(manifest));
    finalized.manifest_hash = await sha256Hex(JSON.stringify(stripManifestForSigning(finalized)));
    finalized.manifest_hash_short = finalized.manifest_hash.slice(0, 16);
    finalized.signature_b64 = await signManifest(finalized, privateKey);
    return finalized;
  }


  /* =========================================================
     HIDDEN WATERMARK HELPERS
     =========================================================
     Prototype note:
     The hidden watermark is stored in the least-significant bits
     of the image data. This is lightweight and easy to inspect,
     but it is not robust enough for real-world guarantees.
     ========================================================= */

  /** Encode the hidden watermark payload as a tagged string. */
  function encodeHiddenPayloadString(payload) {
    return MAGIC + "|" + JSON.stringify(payload);
  }

  /** Decode the tagged watermark string back into an object. */
  function decodeHiddenPayloadString(s) {
    if (!s.startsWith(MAGIC + "|")) return null;
    try {
      return JSON.parse(s.slice(MAGIC.length + 1));
    } catch {
      return null;
    }
  }

  /**
   * Embed a hidden watermark into a canvas.
   *
   * Main steps:
   * 1. Convert payload to bytes
   * 2. Prefix payload length
   * 3. Store each bit in the LSB of the red channel
   */
  function embedHiddenWatermark(targetCanvas, payload) {
    const c = copyCanvas(targetCanvas);
    const ctx = c.getContext("2d");
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const data = img.data;

    const text = encodeHiddenPayloadString(payload);
    const bytes = new TextEncoder().encode(text);

    const len = bytes.length;
    const withLen = new Uint8Array(2 + len);
    withLen[0] = (len >> 8) & 255;
    withLen[1] = len & 255;
    withLen.set(bytes, 2);

    const totalBits = withLen.length * 8;
    if (totalBits > data.length / 4) {
      throw new Error("Image too small for watermark payload.");
    }

    let bitIndex = 0;

    for (let i = 0; i < withLen.length; i++) {
      for (let b = 7; b >= 0; b--) {
        const bit = (withLen[i] >> b) & 1;
        const px = bitIndex * 4;
        data[px] = (data[px] & 0xfe) | bit;
        bitIndex++;
      }
    }

    ctx.putImageData(img, 0, 0);
    return c;
  }

  /**
   * Extract the hidden watermark from a canvas.
   *
   * Main steps:
   * 1. Read first two bytes = payload length
   * 2. Read payload bytes bit-by-bit
   * 3. Decode payload string
   */
  function extractHiddenWatermark(canvas) {
    const ctx = canvas.getContext("2d");
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = img.data;

    function readByte(startBit) {
      let v = 0;
      for (let i = 0; i < 8; i++) {
        const px = (startBit + i) * 4;
        v = (v << 1) | (data[px] & 1);
      }
      return v;
    }

    const len = (readByte(0) << 8) | readByte(8);
    if (!len || len > 2048) return null;

    const bytes = new Uint8Array(len);
    let bitStart = 16;

    for (let i = 0; i < len; i++) {
      bytes[i] = readByte(bitStart);
      bitStart += 8;
    }

    return decodeHiddenPayloadString(new TextDecoder().decode(bytes));
  }

  /* =========================================================
     PIXEL WATERMARK RENDERING
     ========================================================= */

  /** Tiny pixel-font patterns used by the visible watermark renderer. */
  function pixelTextPattern(char) {
    const maps = {
      "A": ["0110", "1001", "1111", "1001", "1001"],
      "I": ["111", "010", "010", "010", "111"],
      "0": ["0110", "1001", "1001", "1001", "0110"],
      "1": ["010", "110", "010", "010", "111"],
      "2": ["1110", "0001", "0110", "1000", "1111"],
      "3": ["1110", "0001", "0110", "0001", "1110"],
      "4": ["1001", "1001", "1111", "0001", "0001"],
      "5": ["1111", "1000", "1110", "0001", "1110"],
      "6": ["0111", "1000", "1110", "1001", "0110"],
      "7": ["1111", "0001", "0010", "0100", "0100"],
      "8": ["0110", "1001", "0110", "1001", "0110"],
      "9": ["0110", "1001", "0111", "0001", "1110"],
      "X": ["1001", "1001", "0110", "1001", "1001"],
      "E": ["1111", "1000", "1110", "1000", "1111"],
      "T": ["11111", "00100", "00100", "00100", "00100"],
      "·": ["0", "0", "1", "0", "0"],
    };
    return maps[char] || ["111", "101", "101", "101", "111"];
  }

  /** Draw one glyph from the pixel font and return its rendered width. */
  function drawPixelGlyph(ctx, x, y, char, cell, color, alpha) {
    const rows = pixelTextPattern(char);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;

    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c] === "1") {
          ctx.fillRect(x + c * cell, y + r * cell, cell - 1, cell - 1);
        }
      }
    }

    ctx.restore();
    return Math.max(...rows.map((r) => r.length)) * cell;
  }

  /** Visible label text for the watermark. */
  function markText(stateCode) {
    return stateCode;
  }

  /**
   * Compute watermark placement and box size.
   * Used both for drawing and hover hit testing.
   */
  function getMarkGeometry(canvas, style) {
    const cell = style.pixelCell;
    const text = markText(style.stateCode);

    const charWidths = {
      "A": 4, "I": 3, "·": 1, "0": 4, "1": 3, "2": 4, "3": 4, "4": 4,
      "5": 4, "6": 4, "7": 4, "8": 4, "9": 4, "X": 4, "E": 4, "T": 5
    };

    let textW = 0;
    for (let i = 0; i < text.length; i++) {
      textW += (charWidths[text[i]] || 4) * cell + cell;
    }

    textW += cell * 2;

    const textH = 5 * cell;
    const pad = cell * 2;
    const boxW = textW + pad * 2;
    const boxH = textH + pad * 2;
    const x = canvas.width - boxW - style.offset;
    const y = canvas.height - boxH - style.offset;

    return { x, y, boxW, boxH, pad, cell, text };
  }

  /**
   * Draw the subtle visible watermark.
   *
   * Main steps:
   * 1. Draw faint background box
   * 2. Draw decorative pixels derived from the manifest hash
   * 3. Draw the pixel-font watermark text
   * 4. If hovered, draw bright outline and tooltip
   */
  function renderSubtlePixelMark(ctx, style, hovered) {
    const g = getMarkGeometry(ctx.canvas, style);
    const { x, y, boxW, boxH, pad, cell, text } = g;

    const baseAlpha = hovered ? style.hoverAlpha : style.baseAlpha;
    const overlayAlpha = hovered ? style.hoverGlowAlpha : 0.05;

    ctx.save();

    ctx.fillStyle = hovered ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.05)";
    ctx.fillRect(x, y, boxW, boxH);

    const short = (style.hashShort || "00000000").slice(0, 8);
    for (let i = 0; i < short.length; i++) {
      const v = parseInt(short[i], 16);
      ctx.globalAlpha = hovered ? 0.32 : 0.12;
      ctx.fillStyle = v % 2 ? "rgba(147,197,253,1)" : "rgba(251,191,36,1)";
      for (let gy = 0; gy < 3; gy++) {
        ctx.fillRect(x + 5 + i * 6, y + 5 + gy * 4 + (v % 2), 3, 2);
      }
    }

    ctx.globalAlpha = 1;

    let cx = x + pad;
    for (let i = 0; i < text.length; i++) {
      const charWidth = drawPixelGlyph(ctx, cx, y + pad, text[i], cell, "rgba(255,255,255,1)", baseAlpha);
      if (hovered) {
        drawPixelGlyph(ctx, cx, y + pad, text[i], cell, "rgba(147,197,253,1)", overlayAlpha);
      }
      cx += charWidth + cell;
    }

    if (hovered) {
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1.3;
      ctx.strokeRect(x - 2, y - 2, boxW + 4, boxH + 4);

      ctx.fillStyle = "rgba(2,6,23,0.85)";
      ctx.fillRect(x - 2, y - 36, Math.max(170, boxW), 28);

      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "12px Arial";
      ctx.fillText("AEM-P state " + style.stateCode, x + 8, y - 18);
    }

    ctx.restore();
    return g;
  }

  /** Determine whether a mouse position is inside the watermark box. */
  function isInsideMark(mx, my, geom) {
    return geom && mx >= geom.x && mx <= geom.x + geom.boxW && my >= geom.y && my <= geom.y + geom.boxH;
  }

  /* =========================================================
     IMAGE EDIT FUNCTIONS
     ========================================================= */

  /** Apply grayscale filter. */
  function grayscale(canvas) {
    const c = copyCanvas(canvas);
    const ctx = c.getContext("2d");
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;

    for (let i = 0; i < d.length; i += 4) {
      const g = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      d[i] = d[i + 1] = d[i + 2] = g;
    }

    ctx.putImageData(img, 0, 0);
    return c;
  }

  /** Apply invert filter. */
  function invert(canvas) {
    const c = copyCanvas(canvas);
    const ctx = c.getContext("2d");
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;

    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i];
      d[i + 1] = 255 - d[i + 1];
      d[i + 2] = 255 - d[i + 2];
    }

    ctx.putImageData(img, 0, 0);
    return c;
  }

  /** Increase brightness by a fixed amount. */
  function brighten(canvas, amount) {
    const c = copyCanvas(canvas);
    const ctx = c.getContext("2d");
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;

    for (let i = 0; i < d.length; i += 4) {
      d[i] = clamp(d[i] + amount, 0, 255);
      d[i + 1] = clamp(d[i + 1] + amount, 0, 255);
      d[i + 2] = clamp(d[i + 2] + amount, 0, 255);
    }

    ctx.putImageData(img, 0, 0);
    return c;
  }

  /** Rotate the canvas by 90 degrees. */
  function rotate90(canvas) {
    const c = document.createElement("canvas");
    c.width = canvas.height;
    c.height = canvas.width;

    const ctx = c.getContext("2d");
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

    return c;
  }

  /** Crop the center area out of the current image. */
  function cropCenter(canvas) {
    const c = document.createElement("canvas");
    const newW = Math.floor(canvas.width * 0.84);
    const newH = Math.floor(canvas.height * 0.84);

    c.width = newW;
    c.height = newH;

    const sx = Math.floor((canvas.width - newW) / 2);
    const sy = Math.floor((canvas.height - newH) / 2);

    c.getContext("2d").drawImage(canvas, sx, sy, newW, newH, 0, 0, newW, newH);
    return c;
  }

  /* =========================================================
     MANIFEST / PACKAGE CREATION
     ========================================================= */

  /**
   * Build and sign a manifest.
   *
   * Main steps:
   * 1. Get signing key
   * 2. Compute payload image hash
   * 3. Build manifest object
   * 4. Hash manifest
   * 5. Sign manifest
   */
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

  /**
   * Build the final bundle shown in the UI and exported as a package.
   *
   * Main steps:
   * 1. Draw visible watermark
   * 2. Build hidden payload
   * 3. Embed hidden watermark
   * 4. Attach viewer snippets
   */
  async function createStateBundle(payloadCanvas, manifest, hoverOn, viewerStyle) {
    /**
     * Build the final export bundle.
     *
     * IMPORTANT DESIGN LESSON
     * -----------------------
     * Earlier versions of this prototype tried to make the manifest sign
     * everything, including fields that only exist after export/render time.
     * That caused a circular dependency:
     *
     * - hidden watermark stored manifest hash
     * - exported image hash depended on final rendered image
     * - final manifest changed again after those fields were added
     * - verifier then rejected the package
     *
     * WHAT THIS VERSION DOES INSTEAD
     * ------------------------------
     * This function separates the process into two layers:
     *
     * 1. Canonical manifest (stable, signed)
     *    - provenance fields
     *    - state
     *    - chain info
     *    - payload hash
     *
     * 2. Derived export fields (not part of signed body)
     *    - hidden watermark payload
     *    - exported rendered image hash
     *    - viewer snippets
     *    - render timestamp
     *
     * DEVELOPER TAKEAWAY
     * ------------------
     * Keep a stable signing boundary.
     * If a field is derived from export/render time data, think very carefully
     * before adding it to the signed manifest body.
     */

    // Step 1: finalize the canonical manifest first.
    // This gives us the stable manifest hash that later layers can reference.
    const canonicalManifest = await finalizeManifest(manifest);

    // Step 2: render the visible mark using the canonical manifest hash.
    // The decorative pixels intentionally derive from this stable short hash.
    let rendered = copyCanvas(payloadCanvas);
    let ctx = rendered.getContext("2d");
    let geom = renderSubtlePixelMark(
      ctx,
      {
        stateCode: canonicalManifest.visible_state,
        hashShort: canonicalManifest.manifest_hash_short,
        baseAlpha: viewerStyle.baseAlpha,
        hoverAlpha: viewerStyle.hoverAlpha,
        hoverGlowAlpha: viewerStyle.hoverGlowAlpha,
        pixelCell: viewerStyle.pixelCell,
        offset: viewerStyle.offset,
      },
      hoverOn
    );

    // Step 3: create the hidden watermark from the CANONICAL manifest hash.
    // This is the key change: the hidden watermark points to the stable signed
    // manifest hash, not to a later export-only variant.
    const hiddenPayload = {
      v: PROTOCOL_VERSION,
      state_code: canonicalManifest.visible_state,
      asset_id_short: canonicalManifest.asset_id.slice(0, 12),
      manifest_hash_short: canonicalManifest.manifest_hash_short,
      manifest_type: canonicalManifest.manifest_type,
      checksum: canonicalManifest.manifest_hash_short.slice(0, 4),
    };

    // Step 4: embed the hidden watermark into the rendered image.
    const embeddedCanvas = embedHiddenWatermark(rendered, hiddenPayload);

    // Step 5: compute export-only metadata.
    // These fields are useful for packaging and UX, but they are NOT part of
    // the canonical signed manifest body.
    const exportManifest = {
      ...canonicalManifest,
      visible_mark: canonicalManifest.visible_state,
      hidden_watermark: hiddenPayload,
      hover_reveal_enabled: true,
      rendered_at: nowIso(),
      exported_canvas_hash: await canvasHash(embeddedCanvas),
      viewer_embed: {
        css: viewerCssSnippet(),
        html: viewerHtmlSnippet(canonicalManifest.visible_state),
        note: "Hover brightening is viewer behavior. The baked PNG only stores the subtle mark.",
      },
    };

    return {
      payloadCanvas,
      renderedCanvas: embeddedCanvas,
      markGeom: geom,
      manifest: exportManifest,
    };
  }

  /* =========================================================
     VERIFIER
     ========================================================= */

  /**
   * Verify an imported package.
   *
   * Checks:
   * 1. Signature validity
   * 2. Hidden watermark consistency
   * 3. Rendered image hash consistency
   *
   * If any check fails, the returned visible state becomes X.
   */
  async function verifyImportedPackage(pkg) {
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

  /** Convenience helper for repeated panel layout in the React UI. */
  function panel(title, children) {
    return e("section", { className: "panel" }, [e("h2", { key: "title" }, title), children]);
  }

  /* =========================================================
     MAIN REACT APP
     ========================================================= */

  function App() {
    /* -------------------------------------------------------
       CANVAS REFS
       ------------------------------------------------------- */
    const editorCanvasRef = React.useRef(null);
    const verifierCanvasRef = React.useRef(null);

    /* -------------------------------------------------------
       REACT STATE
       ------------------------------------------------------- */
    const [mode, setMode] = React.useState("editor");
    const [payloadCanvas, setPayloadCanvas] = React.useState(null);
    const [renderedCanvas, setRenderedCanvas] = React.useState(null);
    const [manifest, setManifest] = React.useState(null);
    const [history, setHistory] = React.useState([]);
    const [busy, setBusy] = React.useState(false);
    const [verification, setVerification] = React.useState(null);
    const [tamperJson, setTamperJson] = React.useState('{"visible_state":"AI·3"}');
    const [hoverOn, setHoverOn] = React.useState(false);
    const [markGeom, setMarkGeom] = React.useState(null);

    // Watermark appearance settings editable in the UI.
    const [viewerStyle, setViewerStyle] = React.useState({
      baseAlpha: 0.16,
      hoverAlpha: 0.96,
      hoverGlowAlpha: 0.28,
      pixelCell: 5,
      offset: 20,
    });

    /** Add a line to the event log shown in the UI. */
    const addLog = React.useCallback((text) => {
      setHistory((prev) => [{ ts: new Date().toLocaleTimeString(), text }, ...prev].slice(0, 50));
    }, []);

    /** Draw a given canvas into a visible UI canvas ref. */
    const syncCanvas = React.useCallback((ref, canvas) => {
      if (!ref.current || !canvas) return;
      ref.current.width = canvas.width;
      ref.current.height = canvas.height;
      ref.current.getContext("2d").drawImage(canvas, 0, 0);
    }, []);

    /**
     * Re-render the current asset into its final visible package.
     * This is the main "refresh everything" function.
     */
    async function refreshRender(currentPayload, currentManifest, hoverState) {
      const bundle = await createStateBundle(currentPayload, currentManifest, hoverState, viewerStyle);

      setPayloadCanvas(bundle.payloadCanvas);
      setRenderedCanvas(bundle.renderedCanvas);
      setManifest(bundle.manifest);
      setMarkGeom(bundle.markGeom);

      syncCanvas(editorCanvasRef, bundle.renderedCanvas);

      if (mode === "verifier") {
        syncCanvas(verifierCanvasRef, bundle.renderedCanvas);
      }

      return bundle;
    }

    /**
     * Initialize from a trusted generated image path.
     * This creates AI·0.
     */
    async function initializeGeneratedCanvas(sourceCanvas, sourceLabel) {
      setBusy(true);
      try {
        const newManifest = await makeSignedManifest({
          prevManifest: null,
          sourceLabel,
          actionType: "created.ai",
          editCountVerified: 0,
          visibleState: STATE.AI0,
          chainStatus: "valid",
          canvas: sourceCanvas,
          viewerStyle,
          manifestType: "origin",
          signerRole: "origin_authority",
          originType: "ai_generated",
        });

        await refreshRender(sourceCanvas, newManifest, false);
        addLog("Created new trusted generated asset → AI·0");
      } finally {
        setBusy(false);
      }
    }

    /**
     * Initialize from an external upload path.
     * This creates EXT and intentionally does not claim AI origin.
     */
    async function initializeExternalCanvas(sourceCanvas, sourceLabel) {
      setBusy(true);
      try {
        const newManifest = await makeSignedManifest({
          prevManifest: null,
          sourceLabel,
          actionType: "import.external",
          editCountVerified: 0,
          visibleState: STATE.EXT,
          chainStatus: "external",
          canvas: sourceCanvas,
          viewerStyle,
          manifestType: "import",
          signerRole: "trusted_editor",
          originType: "external_import",
        });

        await refreshRender(sourceCanvas, newManifest, false);
        addLog("Imported external image → EXT");
      } finally {
        setBusy(false);
      }
    }

    /** Create a trusted demo image on first load. */
    React.useEffect(() => {
      initializeGeneratedCanvas(createDemoBaseCanvas(), "demo_generator");
    }, []);

    /** Re-render whenever visual watermark settings change. */
    React.useEffect(() => {
      if (!payloadCanvas || !manifest) return;
      refreshRender(payloadCanvas, { ...manifest, viewer_style: viewerStyle }, hoverOn);
    }, [
      viewerStyle.baseAlpha,
      viewerStyle.hoverAlpha,
      viewerStyle.hoverGlowAlpha,
      viewerStyle.pixelCell,
      viewerStyle.offset,
    ]);

    /**
     * Apply a trusted edit.
     *
     * Main steps:
     * 1. Transform the payload canvas
     * 2. Derive the next visible state
     * 3. Create new manifest
     * 4. Re-render package
     */
    async function applyTrustedEdit(actionType, transformFn) {
      if (!payloadCanvas || !manifest) return;

      setBusy(true);

      try {
        const editedPayload = transformFn(payloadCanvas);
        const next = deriveNextTrustedState(manifest.visible_state, manifest.edit_count_verified);

        const nextManifest = await makeSignedManifest({
          prevManifest: manifest,
          sourceLabel: manifest.source_label,
          actionType,
          editCountVerified: next.editCountVerified,
          visibleState: next.visibleState,
          chainStatus: next.visibleState === STATE.EXT ? "external" : manifest.visible_state === STATE.X ? "broken" : "valid",
          canvas: editedPayload,
          viewerStyle,
          manifestType: manifest.visible_state === STATE.EXT ? "edit" : "edit",
          signerRole: "trusted_editor",
          originType: manifest.origin_type,
        });

        await refreshRender(editedPayload, nextManifest, false);
        setHoverOn(false);
        addLog("Trusted edit: " + actionType + " → " + next.visibleState);
      } finally {
        setBusy(false);
      }
    }

    /**
     * Update metadata without changing the visible edit count or state.
     */
    async function metadataOnly() {
      if (!payloadCanvas || !manifest) return;

      setBusy(true);

      try {
        const nextManifest = await makeSignedManifest({
          prevManifest: manifest,
          sourceLabel: manifest.source_label,
          actionType: "metadata_only",
          editCountVerified: manifest.edit_count_verified,
          visibleState: manifest.visible_state,
          chainStatus: manifest.chain_status,
          canvas: payloadCanvas,
          viewerStyle,
          manifestType: "edit",
          signerRole: "trusted_editor",
          originType: manifest.origin_type,
        });

        await refreshRender(payloadCanvas, nextManifest, hoverOn);
        addLog("Metadata-only update → state unchanged at " + nextManifest.visible_state);
      } finally {
        setBusy(false);
      }
    }

    /**
     * Force a broken-chain state.
     * Simulates unsupported or untrusted modification.
     */
    async function breakChain(reason) {
      if (!payloadCanvas || !manifest) return;

      setBusy(true);

      try {
        const brokenManifest = await makeSignedManifest({
          prevManifest: manifest,
          sourceLabel: manifest.source_label,
          actionType: "chain_broken_detected",
          editCountVerified: manifest.edit_count_verified,
          visibleState: STATE.X,
          chainStatus: "broken",
          canvas: payloadCanvas,
          breakReason: reason,
          viewerStyle,
          manifestType: "broken",
          signerRole: "trusted_editor",
          originType: manifest.origin_type,
        });

        await refreshRender(payloadCanvas, brokenManifest, false);
        setHoverOn(false);
        addLog("Forced broken chain → X");
      } finally {
        setBusy(false);
      }
    }

    /** Export package = manifest + rendered image data URL. */
    async function exportPackage() {
      if (!renderedCanvas || !manifest) return;

      const pkg = {
        package_version: 3,
        manifest,
        image_data_url: renderedCanvas.toDataURL("image/png"),
      };

      const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
      downloadBlob("aem_p_package.json", blob);
    }

    /** Export manifest only. */
    async function exportManifest() {
      if (!manifest) return;
      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
      downloadBlob("aem_p_manifest.json", blob);
    }

    /** Export the rendered PNG only. */
    async function exportPng() {
      if (!renderedCanvas) return;
      renderedCanvas.toBlob((blob) => blob && downloadBlob("aem_p_export.png", blob), "image/png");
    }

    /**
     * Load a previously exported package into verifier mode.
     */
    async function loadPackageFile(ev) {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;

      setBusy(true);

      try {
        const pkg = JSON.parse(await file.text());

        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = pkg.image_data_url;
        });

        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext("2d").drawImage(img, 0, 0);

        syncCanvas(verifierCanvasRef, canvas);
        setVerification(await verifyImportedPackage(pkg));
        addLog("Loaded package for verification");
      } catch {
        alert("Could not load package.");
      } finally {
        setBusy(false);
        ev.target.value = "";
      }
    }

    /**
     * Upload a fresh external image from disk.
     * This path now creates EXT instead of AI·0.
     */
    async function uploadExternalImage(ev) {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;

      setBusy(true);

      try {
        const loaded = await imageFromFile(file);
        const c = document.createElement("canvas");
        c.width = loaded.img.width;
        c.height = loaded.img.height;
        c.getContext("2d").drawImage(loaded.img, 0, 0);
        URL.revokeObjectURL(loaded.url);

        await initializeExternalCanvas(c, "uploaded_image");
      } catch {
        alert("Could not read image.");
      } finally {
        setBusy(false);
        ev.target.value = "";
      }
    }

    /**
     * Simulate manifest tampering by applying a JSON patch without re-signing.
     * The modified package is then sent to verifier mode.
     */
    async function tamperManifestJson() {
      if (!manifest || !renderedCanvas) return;

      setBusy(true);

      try {
        let patch = {};
        try {
          patch = JSON.parse(tamperJson);
        } catch {
          alert("Invalid JSON patch.");
          setBusy(false);
          return;
        }

        const tampered = JSON.parse(JSON.stringify(manifest));
        Object.assign(tampered, patch);

        const pkg = {
          package_version: 3,
          manifest: tampered,
          image_data_url: renderedCanvas.toDataURL("image/png"),
        };

        setVerification(await verifyImportedPackage(pkg));
        setMode("verifier");
        syncCanvas(verifierCanvasRef, renderedCanvas);
        addLog("Tampered package preview sent to verifier");
      } finally {
        setBusy(false);
      }
    }

    /**
     * Canvas mouse-move handler for hover reveal.
     *
     * Main steps:
     * 1. Convert pointer position into canvas coordinates
     * 2. Check whether pointer is inside watermark bounds
     * 3. Re-render with hover highlight if needed
     */
    function handleCanvasMove(ev) {
      if (!editorCanvasRef.current || !markGeom || !manifest) return;

      const rect = editorCanvasRef.current.getBoundingClientRect();
      const scaleX = editorCanvasRef.current.width / rect.width;
      const scaleY = editorCanvasRef.current.height / rect.height;

      const mx = (ev.clientX - rect.left) * scaleX;
      const my = (ev.clientY - rect.top) * scaleY;

      const inside = isInsideMark(mx, my, markGeom);

      if (inside !== hoverOn) {
        setHoverOn(inside);
        refreshRender(payloadCanvas, manifest, inside);
      }
    }

    /** Turn off hover state when the pointer leaves the canvas. */
    function handleCanvasLeave() {
      if (!hoverOn || !payloadCanvas || !manifest) return;
      setHoverOn(false);
      refreshRender(payloadCanvas, manifest, false);
    }

    /* -------------------------------------------------------
       SMALL DERIVED UI VALUES
       ------------------------------------------------------- */
    const stateBadge = manifest ? manifest.visible_state : "—";
    const verifyBadgeClass = !verification ? "badge warn" : verification.ok ? "badge good" : "badge bad";

    /* -------------------------------------------------------
       JSX-LIKE RENDER TREE
       ------------------------------------------------------- */
    return e("div", { className: "container" }, [
      e("div", { className: "header", key: "header" }, [
        e("h1", { key: "title" }, "AEM-P — Hover + EXT Demo"),
        e(
          "p",
          { key: "subtitle" },
          "Prototype demo with separate generated vs external paths, a subtle pixel watermark, hover reveal, lightweight manifest, and verifier flow."
        ),
        e("div", { className: "topRow", key: "topRow" }, [
          e("button", { className: "btnMode", key: "editorMode", onClick: () => setMode("editor") }, "Editor mode"),
          e("button", { className: "btnMode", key: "verifierMode", onClick: () => setMode("verifier") }, "Verifier mode"),
          manifest ? e("span", { className: "badge", key: "state" }, "Current state: " + stateBadge) : null,
        ]),
      ]),

      mode === "editor"
        ? e("div", { className: "grid", key: "editorGrid" }, [
            e("div", { key: "left" }, [
              panel("Editor controls", e("div", { className: "stack" }, [
                e("div", { className: "row", key: "statusRow" }, [
                  e("span", { className: "badge" }, "State: " + stateBadge),
                  e("span", { className: "badge" }, "Chain: " + (manifest ? manifest.chain_status : "—")),
                  e("span", { className: "badge" }, "Edits: " + (manifest ? manifest.edit_count_verified : "—")),
                ]),
                e("div", { className: "small", key: "hoverHint" }, "Move the mouse over the lower-right watermark area to reveal the bright hover state."),

                e("h3", { key: "trustedHeading" }, "Trusted generated path"),
                e("div", { className: "row", key: "trustedRow" }, [
                  e("button", { className: "btnGenerate", onClick: () => initializeGeneratedCanvas(createDemoBaseCanvas(), "demo_generator"), disabled: busy }, "New generated demo image → AI·0"),
                ]),

                e("h3", { key: "externalHeading" }, "External import path"),
                e("div", { className: "row", key: "externalRow" }, [
                  e("input", { type: "file", accept: "image/*", onChange: uploadExternalImage }),
                ]),
                e("div", { className: "small", key: "externalNote" }, "Uploads are treated as EXT and do not claim AI origin."),

                e("h3", { key: "editHeading" }, "Trusted edits"),
                e("div", { className: "row", key: "editRow" }, [
                  e("button", { className: "btnEdit", onClick: () => applyTrustedEdit("filtered.grayscale", grayscale), disabled: busy }, "Grayscale"),
                  e("button", { className: "btnEdit", onClick: () => applyTrustedEdit("filtered.invert", invert), disabled: busy }, "Invert"),
                  e("button", { className: "btnEdit", onClick: () => applyTrustedEdit("filtered.brighten", (c) => brighten(c, 20)), disabled: busy }, "Brighten"),
                  e("button", { className: "btnEdit", onClick: () => applyTrustedEdit("rotated.90", rotate90), disabled: busy }, "Rotate 90°"),
                  e("button", { className: "btnEdit", onClick: () => applyTrustedEdit("cropped.center", cropCenter), disabled: busy }, "Crop center"),
                ]),
                e("div", { className: "small", key: "editRules" }, "Edit rules: AI states increment, EXT stays EXT, X stays X."),

                e("h3", { key: "styleHeading" }, "Watermark appearance"),
                e("div", { className: "sliderLabel" }, [e("span", null, "Subtle opacity"), e("span", null, viewerStyle.baseAlpha.toFixed(2))]),
                e("input", { type: "range", min: "0.05", max: "0.35", step: "0.01", value: viewerStyle.baseAlpha, onChange: (ev) => setViewerStyle({ ...viewerStyle, baseAlpha: Number(ev.target.value) }) }),
                e("div", { className: "sliderLabel" }, [e("span", null, "Hover opacity"), e("span", null, viewerStyle.hoverAlpha.toFixed(2))]),
                e("input", { type: "range", min: "0.70", max: "1.00", step: "0.01", value: viewerStyle.hoverAlpha, onChange: (ev) => setViewerStyle({ ...viewerStyle, hoverAlpha: Number(ev.target.value) }) }),
                e("div", { className: "sliderLabel" }, [e("span", null, "Pixel size"), e("span", null, String(viewerStyle.pixelCell))]),
                e("input", { type: "range", min: "3", max: "8", step: "1", value: viewerStyle.pixelCell, onChange: (ev) => setViewerStyle({ ...viewerStyle, pixelCell: Number(ev.target.value) }) }),
                e("div", { className: "sliderLabel" }, [e("span", null, "Corner offset"), e("span", null, String(viewerStyle.offset))]),
                e("input", { type: "range", min: "12", max: "40", step: "1", value: viewerStyle.offset, onChange: (ev) => setViewerStyle({ ...viewerStyle, offset: Number(ev.target.value) }) }),

                e("h3", { key: "specialHeading" }, "Special actions"),
                e("div", { className: "row", key: "specialRow" }, [
                  e("button", { className: "btnSpecial", onClick: metadataOnly, disabled: busy }, "Metadata only"),
                  e("button", { className: "btnSpecial", onClick: () => breakChain("edited_outside_trusted_toolchain"), disabled: busy }, "Force broken chain → X"),
                ]),

                e("h3", { key: "exportHeading" }, "Export"),
                e("div", { className: "row", key: "exportRow" }, [
                  e("button", { className: "btnExport", onClick: exportPng, disabled: busy }, "Download PNG"),
                  e("button", { className: "btnExport", onClick: exportManifest, disabled: busy || !manifest }, "Download manifest"),
                  e("button", { className: "btnExport", onClick: exportPackage, disabled: busy || !manifest }, "Download package"),
                ]),

                e("h3", { key: "tamperHeading" }, "Tamper test"),
                e("div", { className: "small", key: "tamperHint" }, "Patch the manifest without re-signing it, then send it to verifier mode."),
                e("textarea", { value: tamperJson, onChange: (ev) => setTamperJson(ev.target.value) }),
                e("div", { className: "row", key: "tamperRow" }, [
                  e("button", { className: "btnSpecial", onClick: tamperManifestJson, disabled: busy || !manifest }, "Send tampered package to verifier"),
                ]),
              ])),

              panel("Event log", e("div", { className: "log" },
                history.length
                  ? history.map((item, idx) =>
                      e("div", { className: "logItem", key: idx }, [
                        e("div", { className: "small", key: "ts" }, item.ts),
                        e("div", { key: "txt" }, item.text),
                      ])
                    )
                  : e("div", { className: "small" }, "No events yet.")
              )),
              panel("Help / Test Guide", e("div", { className: "stack" }, [
                e("div", { className: "small", key: "g1" }, "Quick tests:"),
                e("div", { className: "small", key: "g2" }, "1. New generated demo image → AI·0, then apply one edit and verify the package."),
                e("div", { className: "small", key: "g3" }, "2. Upload an external image → EXT, export package, verify it, and confirm the verifier shows Verified: EXT."),
                e("div", { className: "small", key: "g4" }, "3. Click Metadata only and verify that the visible state stays the same while the package still verifies."),
                e("div", { className: "small", key: "g5" }, "4. Force broken chain → X, export, and confirm the broken state behavior."),
                e("div", { className: "small", key: "g6" }, "5. Use the tamper test and confirm the verifier returns X."),
                e("h3", { key: "hmeta" }, "Metadata only"),
                e("div", { className: "small", key: "m1" }, "Metadata only creates a new signed version without changing the visible state or edit count."),
                e("div", { className: "small", key: "m2" }, "Use it to test whether provenance updates can happen without counting as visual edits."),
                e("div", { className: "small", key: "m3" }, "Expected result after export + verify: same visible state, still valid."),
                e("h3", { key: "htamper" }, "Tamper test"),
                e("div", { className: "small", key: "t1" }, "The tamper test modifies the manifest without recomputing the signature. The verifier should reject it."),
                e("div", { className: "small", key: "t2" }, "Useful examples:"),
                e("pre", { key: "t3" }, '{"visible_state":"AI·9"}\n{"edit_count_verified":0}\n{"origin_type":"ai_generated"}\n{"chain_status":"valid"}'),
                e("div", { className: "small", key: "t4" }, "Expected result: Verification failed → X, often with signature_invalid or another mismatch reason.")
              ])),
            ]),

            e("div", { key: "center" },
              panel("Rendered image", e("div", { className: "canvasWrap" }, [
                e("canvas", {
                  ref: editorCanvasRef,
                  onMouseMove: handleCanvasMove,
                  onMouseLeave: handleCanvasLeave,
                }),
              ]))
            ),

            e("div", { key: "right" }, [
              panel("Manifest preview", e("pre", null, manifest ? JSON.stringify(manifest, null, 2) : "Loading…")),
              panel("Notes", e("div", null, [
                e("div", { className: "kv", key: "n1" }, [e("div", { className: "k" }, "Generated path"), e("div", { className: "v" }, "Creates AI·0 using the trusted demo path")]),
                e("div", { className: "kv", key: "n2" }, [e("div", { className: "k" }, "External path"), e("div", { className: "v" }, "Uploads become EXT and do not claim AI origin")]),
                e("div", { className: "kv", key: "n3" }, [e("div", { className: "k" }, "Visible mark"), e("div", { className: "v" }, "Subtle, pixelated, and brightens on hover")]),
                e("div", { className: "kv", key: "n4" }, [e("div", { className: "k" }, "Hidden mark"), e("div", { className: "v" }, "Prototype LSB payload in pixel data")]),
                e("div", { className: "kv", key: "n5" }, [e("div", { className: "k" }, "Verifier"), e("div", { className: "v" }, "Checks canonical signature, hidden payload, and exported image hash")]),
                e("div", { className: "small", key: "n6" }, "Developer note: the signed manifest and the export package are intentionally treated as two layers. If future changes mix export-only fields back into the signed manifest body, verifier mismatches can return."),
              ])),
            ]),
          ])
        : e("div", { className: "grid", key: "verifierGrid" }, [
            e("div", { key: "left" }, [
              panel("Verifier controls", e("div", { className: "stack" }, [
                e("div", { className: verifyBadgeClass, key: "verifyState" },
                  verification
                    ? (verification.ok ? "Verified: " + verification.visible_state : "Verification failed → X")
                    : "Load a package to verify"
                ),
                verification
                  ? e("div", { className: "small", key: "verifyReasons" }, verification.ok ? "All checks passed." : "Reasons: " + verification.reasons.join(", "))
                  : null,
                e("h3", { key: "loadHeading" }, "Load package"),
                e("input", { type: "file", accept: ".json,application/json", onChange: loadPackageFile }),
                e("div", { className: "small", key: "verifyHint" }, "Expected file: a JSON package containing the rendered PNG as a data URL plus the manifest."),
              ])),
              panel("Help / Test Guide", e("div", { className: "stack" }, [
                e("div", { className: "small", key: "vh1" }, "Verifier quick guide:"),
                e("div", { className: "small", key: "vh2" }, "Generated path should verify as AI·0 or a later AI state."),
                e("div", { className: "small", key: "vh3" }, "External path should verify as EXT."),
                e("div", { className: "small", key: "vh4" }, "Tampered packages should fail and return X."),
                e("div", { className: "small", key: "vh5" }, "Metadata-only packages should keep the same visible state and still verify."),
              ])),
            ]),

            e("div", { key: "center" },
              panel("Verified image preview", e("div", { className: "canvasWrap" }, [
                e("canvas", { ref: verifierCanvasRef }),
              ]))
            ),

            e("div", { key: "right" }, [
              panel("Verification output", e("pre", null, verification ? JSON.stringify(verification, null, 2) : "No package loaded.")),
              panel("Interpretation", e("div", null, [
                e("div", { className: "kv", key: "i1" }, [e("div", { className: "k" }, "AI·0"), e("div", { className: "v" }, "Trusted generated origin")]),
                e("div", { className: "kv", key: "i2" }, [e("div", { className: "k" }, "AI·1–9"), e("div", { className: "v" }, "Verified AI-origin edit count")]),
                e("div", { className: "kv", key: "i3" }, [e("div", { className: "k" }, "EXT"), e("div", { className: "v" }, "External import, not AI-origin certified")]),
                e("div", { className: "kv", key: "i4" }, [e("div", { className: "k" }, "X"), e("div", { className: "v" }, "Broken or unverifiable provenance")]),
              ])),
            ]),
          ]),
        ]);
  }

  /* =========================================================
     APP START
     ========================================================= */

  ReactDOM.createRoot(document.getElementById("root")).render(e(App));
})();
