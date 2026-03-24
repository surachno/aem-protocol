/**
 * AEM Protocol — app.js
 * ------------------------------------------------
 * Small bootstrap file.
 *
 * Runtime modules:
 * - manifest.js
 * - watermark.js
 * - ui.js
 */
(function () {
  const e = React.createElement;
  ReactDOM.createRoot(document.getElementById("root")).render(e(window.AEMUI.App));
})();
