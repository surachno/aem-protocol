/**
 * AEM Protocol — watermark.js
 * ------------------------------------------------
 * Real split module:
 * - image/canvas helpers
 * - hidden watermark helpers
 * - visible watermark rendering
 * - image edit transforms
 *
 * This split keeps rendering logic separate from signing logic.
 */
(function (global) {
  const {
    PROTOCOL_VERSION,
    MAGIC,
    nowIso,
    clamp,
    canvasHash,
    finalizeManifest
  } = global.AEMManifest;

function viewerCssSnippet() {
    return `.aem-viewer { position: relative; display: inline-block; }
.aem-viewer img { display: block; max-width: 100%; height: auto; }
.aem-hover-mark {
  position: absolute; right: 18px; bottom: 18px; padding: 8px 10px;
  font: 700 12px/1 monospace; letter-spacing: .08em;
  color: rgba(255,255,255,.12); background: rgba(255,255,255,.04);
  image-rendering: pixelated; transition: all .18s ease;
}
.aem-viewer:hover .aem-hover-mark,.aem-hover-mark:focus {
  color: rgba(255,255,255,.98); background: rgba(2,6,23,.86);
  box-shadow: 0 0 0 1px rgba(255,255,255,.35), 0 0 18px rgba(147,197,253,.28);
}`;
  }

function viewerHtmlSnippet(stateCode) {
    return `<div class="aem-viewer">
  <img src="your-image.png" alt="AEM image" />
  <div class="aem-hover-mark" aria-label="AEM state ${stateCode}">${stateCode}</div>
</div>`;
  }

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
    ctx.font = "bold 90px Arial";
    ctx.fillText("AEM demo image", 72, 640);

    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.font = "28px Arial";
    ctx.fillText("Generated inside the trusted demo path", 72, 684);

    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 3;
    ctx.strokeRect(52, 52, c.width - 104, c.height - 104);

    return c;
  }

function copyCanvas(source) {
    const c = document.createElement("canvas");
    c.width = source.width;
    c.height = source.height;
    c.getContext("2d").drawImage(source, 0, 0);
    return c;
  }

function imageFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = reject;
      img.src = url;
    });
  }

function encodeHiddenPayloadString(payload) {
    return MAGIC + "|" + JSON.stringify(payload);
  }

function decodeHiddenPayloadString(s) {
    if (!s.startsWith(MAGIC + "|")) return null;
    try {
      return JSON.parse(s.slice(MAGIC.length + 1));
    } catch {
      return null;
    }
  }

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

function markText(stateCode) {
    return stateCode;
  }

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
      ctx.fillText("AEM state " + style.stateCode, x + 8, y - 18);
    }

    ctx.restore();
    return g;
  }

function isInsideMark(mx, my, geom) {
    return geom && mx >= geom.x && mx <= geom.x + geom.boxW && my >= geom.y && my <= geom.y + geom.boxH;
  }

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


  global.AEMWatermark = {
    viewerCssSnippet,
    viewerHtmlSnippet,
    createDemoBaseCanvas,
    copyCanvas,
    imageFromFile,
    encodeHiddenPayloadString,
    decodeHiddenPayloadString,
    embedHiddenWatermark,
    extractHiddenWatermark,
    pixelTextPattern,
    drawPixelGlyph,
    markText,
    getMarkGeometry,
    renderSubtlePixelMark,
    isInsideMark,
    grayscale,
    invert,
    brighten,
    rotate90,
    cropCenter,
    createStateBundle
  };
})(window);
