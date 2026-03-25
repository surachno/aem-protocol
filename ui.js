/**
 * AEM Protocol — ui.js
 * ------------------------------------------------
 * Real split module:
 * - panel helper
 * - main React app
 * - editor / verifier interactions
 *
 * This split keeps UI code separate from manifest and watermark logic.
 */
(function (global) {
  const e = React.createElement;
  const {
    STATE,
    deriveNextTrustedState,
    makeSignedManifest,
    verifyImportedPackage,
    downloadBlob
  } = global.AEMManifest;
  const {
    createDemoBaseCanvas,
    imageFromFile,
    grayscale,
    invert,
    brighten,
    rotate90,
    cropCenter,
    isInsideMark,
    createStateBundle
  } = global.AEMWatermark;

function panel(title, children) {
    return e("section", { className: "panel" }, [e("h2", { key: "title" }, title), children]);
  }

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

    /** Export package = manifest + rendered image data URL.
     * Uses downloadBlob() from the manifest module.
     */
    async function exportPackage() {
      if (!renderedCanvas || !manifest) return;

      const pkg = {
        package_version: 3,
        manifest,
        image_data_url: renderedCanvas.toDataURL("image/png"),
      };

      const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
      downloadBlob("aem_package.json", blob);
    }

    /** Export manifest only. */
    async function exportManifest() {
      if (!manifest) return;
      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
      downloadBlob("aem_manifest.json", blob);
    }

    /** Export the rendered PNG only. */
    async function exportPng() {
      if (!renderedCanvas) return;
      renderedCanvas.toBlob((blob) => blob && downloadBlob("aem_export.png", blob), "image/png");
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
        e("h1", { key: "title" }, "AEM Protocol — Hover + EXT Demo"),
        e(
          "p",
          { key: "subtitle" },
          "Prototype demo with separate generated vs external paths, a subtle pixel watermark, hover reveal, lightweight manifest, and verifier flow."
        ),
        e(
          "p",
          { key: "subtitle" },
          `Try this: 1. Click "New generated demo image" 2. Apply an edit 3. Download package 4. Verify it in the "Verifier Mode"`
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
                  e("div", { className: "small", key: "hoverHint" }, "AI·0 = AI-generated, no edits yet."),
                ]),

                e("h3", { key: "externalHeading" }, "External import path"),
                e("div", { className: "row", key: "externalRow" }, [
                  e("input", { className: "uploadFile", type: "file", accept: "image/*", onChange: uploadExternalImage }),
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
                  e("button", { className: "btnExport", onClick: exportPackage, disabled: busy || !manifest }, "Download package (demo bundle)"),
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
                e("div", { className: "small", key: "t4" }, "Expected result: Verification failed → X, often with signature_invalid or another mismatch reason."),
                e("div", { key: "t5" }, "For a more detailed test manual use file MANUAL_TESTS.md")
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
              panel("Manifest preview (current manifest)", e("pre", null, manifest ? JSON.stringify(manifest, null, 2) : "Loading…")),
              panel("How this works", e("div", { className: "stack" }, [
                e("div", { className: "small" }, "AI·0 - Generated path: AI·0 creation using the trusted demo path"),
                e("div", { className: "small" }, "AI·1 - If current state is AI·0, it becomes AI·1 after a trusted edit"),
                e("div", { className: "small" }, "AI·2 - Then AI·2, and so on"),
                e("div", { className: "small" }, "AI·9 - Remains the same after any trusted edits"),
                e("div", { className: "small" }, "EXT  - Uploads become 'External path': no claim AI origin"),
                e("div", { className: "small" }, "X    - If current state is X, it stays X (broken trust chain)"),
                e("div", { className: "small" }, ""),
                e("div", { className: "small" }, "Visible mark → Subtle, pixelated, and brightens on hover"),
                e("div", { className: "small" }, "Hidden mark → Prototype LSB payload embedded in pixel data"),
                e("div", { className: "small" }, "Verifier → Checks canonical manifest signature, hidden watermark consistency, and exported image consistency"),
                e("div", { className: "small" }, "Developer note → The signed manifest and the export package are intentionally treated as separate layers")
              ])),
            ]),
          ])
        : e("div", { className: "grid", key: "verifierGrid" }, [
            e("div", { key: "left" }, [
              panel("Verifier controls", e("div", { className: "stack" }, [
                e("div", { className: verifyBadgeClass, key: "verifyState" },
                  verification
                    ? (verification.ok ? "Verified: " + verification.visible_state : "Verification failed → X")
                    : "Load a demo package (bundle of image + manifest). Future integrations may use separate image and manifest files."
                ),
                verification
                  ? e("div", { className: "small", key: "verifyReasons" }, verification.ok ? "All checks passed." : "Reasons: " + verification.reasons.join(", "))
                  : null,
                e("h3", { key: "loadHeading" }, "Load package (bundle)"),
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


  global.AEMUI = { panel, App };
})(window);
