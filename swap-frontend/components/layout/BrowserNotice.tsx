/**
 * Shown only on browsers too old for the UI (html.unsupported, set by BROWSER_CHECK_SCRIPT).
 * Plain markup with inline styles: no Tailwind, no JavaScript, so it renders anywhere.
 */
export function BrowserNotice() {
  return (
    <div id="browser-notice" role="alert">
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, color: '#17815F' }}>SWAP PORTAL · MSU MARAWI</div>
        <h1 style={{ fontSize: 24, margin: '16px 0 10px', lineHeight: 1.3 }}>Please update your browser</h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0, color: '#4E5E55' }}>
          This browser is too old to show the SWAP Portal properly. Update it, or open the portal in a current version of
          Chrome, Edge, Firefox, Safari or Samsung Internet.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 14, color: '#4E5E55' }}>
          On an iPhone or iPad, update to iOS 16.4 or later (Settings → General → Software Update).
        </p>
      </div>
    </div>
  )
}
