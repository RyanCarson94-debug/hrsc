/**
 * Dovetail HR Copilot widget integration.
 *
 * Widget renders entirely inside a Shadow DOM on DIV#auxi-chat-widget.
 * The chat input is a contenteditable DIV inside that shadow root.
 * Communication uses WebSocket (wss://conversation.copilot-eu.dovetailnow.com).
 *
 * To trigger an intent we:
 *   1. Ensure the widget panel is visually open
 *   2. Wait for the contenteditable editor to appear in the shadow root
 *   3. Set its text content and dispatch React-compatible input events
 *   4. Submit via Enter keydown then send button click (with delay for React state)
 *
 * To reset the session we click X → Yes in the confirmation dialog.
 * This sends the EXIT WebSocket command and starts a new connection.
 *
 * Panel states:
 *   - Launcher-only: only 1 button (the floating bubble) — panel not in DOM
 *   - Panel hidden:  4+ buttons in DOM but panel is CSS-hidden (minimize was clicked)
 *   - Panel visible: 4+ buttons in DOM and X button has nonzero bounding rect
 */

function getShadowRoot() {
  return document.getElementById('auxi-chat-widget')?.shadowRoot ?? null
}

/** True when the panel is present in the shadow DOM (visible or CSS-hidden). */
function isPanelInDOM(shadow) {
  return (shadow?.querySelectorAll('button').length ?? 0) > 1
}

/** True when the panel is visible to the user (X button has nonzero bounding rect). */
function isPanelVisible(shadow) {
  const buttons = [...(shadow?.querySelectorAll('button') ?? [])]
  if (buttons.length <= 1) return false
  const rect = buttons[0].getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

/**
 * Ensure the chat panel is open and visible.
 * Handles three states: launcher-only, panel CSS-hidden, panel already visible.
 */
function openWidget(shadow) {
  if (isPanelVisible(shadow)) return

  if (isPanelInDOM(shadow)) {
    // Panel is in DOM but CSS-hidden (minimize was clicked) — toggle it back open
    const buttons = [...shadow.querySelectorAll('button')]
    const minimizeBtn = buttons.find(b =>
      b.querySelector('path')?.getAttribute('d')?.startsWith('M3 10')
    ) ?? buttons[1]
    minimizeBtn?.click()
  } else {
    // Launcher-only state — click the launcher bubble to open the panel
    shadow?.querySelector('button')?.click()
  }
}

/**
 * Suppress the widget auto-opening on page load.
 * Call once on app startup — polls until the shadow root appears, then
 * minimizes the widget if it opened automatically.
 */
export function initDovetail() {
  let attempts = 0
  function tryMinimize() {
    attempts++
    const shadow = getShadowRoot()
    if (!shadow) {
      if (attempts < 12) setTimeout(tryMinimize, 500)
      return
    }
    if (!isPanelVisible(shadow)) return
    // btn[1] is the minus/minimize button (SVG path starts 'M3 10')
    const buttons = [...shadow.querySelectorAll('button')]
    const minimizeBtn = buttons.find(b =>
      b.querySelector('path')?.getAttribute('d')?.startsWith('M3 10')
    ) ?? buttons[1]
    minimizeBtn?.click()
  }
  setTimeout(tryMinimize, 800)
}

/**
 * Start a new conversation in the widget.
 * Clicks the X/exit button which triggers a confirmation dialog,
 * then clicks "Yes" — the widget sends EXIT and creates a new WebSocket session.
 */
export async function clearDovetailSession() {
  const shadow = getShadowRoot()
  if (!shadow) return

  // Panel must be in DOM so we can access its buttons
  if (!isPanelInDOM(shadow)) {
    shadow?.querySelector('button')?.click()
    await new Promise(r => setTimeout(r, 600))
  }

  // btn[0] is the X/exit button (SVG path starts M4.293)
  const buttons = [...shadow.querySelectorAll('button')]
  const exitBtn = buttons.find(b =>
    b.querySelector('path')?.getAttribute('d')?.startsWith('M4.293')
  ) ?? buttons[0]

  if (!exitBtn) return
  exitBtn.click()

  // Wait for the "Yes" confirmation button and click it
  await new Promise((resolve) => {
    function tryClickYes() {
      const allBtns = [...shadow.querySelectorAll('button')]
      const yesBtn = allBtns.find(b => b.textContent.trim() === 'Yes')
      if (yesBtn) { yesBtn.click(); resolve(); return true }
      return false
    }
    if (tryClickYes()) return
    const observer = new MutationObserver(() => {
      if (tryClickYes()) observer.disconnect()
    })
    observer.observe(shadow, { childList: true, subtree: true })
    setTimeout(() => { observer.disconnect(); resolve() }, 3000)
  })
}

async function shadowDOMTrigger(intentText) {
  const shadow = getShadowRoot()
  if (!shadow) return false

  openWidget(shadow)

  return new Promise((resolve) => {
    function tryFill() {
      const editor = shadow.querySelector('[contenteditable]')
      if (!editor) return false

      // Ensure panel is visible before filling (openWidget may need a tick to take effect)
      if (!isPanelVisible(shadow)) return false

      editor.focus()

      // Use execCommand so React's synthetic event system picks up the change
      // (works for contenteditable divs; direct innerText assignment does not fire React events)
      editor.innerHTML = ''
      document.execCommand('insertText', false, intentText)

      // Fallback: set innerText directly and fire input event manually
      if (!editor.textContent.trim()) {
        editor.innerText = intentText
        editor.dispatchEvent(new Event('input', { bubbles: true }))
      }

      // Wait for React state to register the typed text before submitting
      setTimeout(() => {
        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, composed: true }))
        editor.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', keyCode: 13, bubbles: true, composed: true }))

        // Give the send button time to enable, then click it
        setTimeout(() => {
          const buttons = [...shadow.querySelectorAll('button')]
          const sendBtn = buttons.find(b =>
            b.querySelector('path')?.getAttribute('d')?.startsWith('M1.946')
          ) ?? buttons[2]
          sendBtn?.click()
          resolve(true)
        }, 300)
      }, 400)
      return true
    }

    if (tryFill()) return

    const observer = new MutationObserver(() => {
      if (tryFill()) { observer.disconnect() }
    })
    observer.observe(shadow, { childList: true, subtree: true })
    setTimeout(() => { observer.disconnect(); resolve(false) }, 4000)
  })
}

/**
 * Trigger a Dovetail Copilot intent by text.
 * Pass { newSession: true } to reset the conversation first.
 */
export async function triggerDovetailIntent(intentText, { newSession = false } = {}) {
  if (!intentText) return

  if (!document.getElementById('auxi-chat-widget')) {
    console.warn('[Dovetail] Widget not found. Ensure auxi-widget script is in index.html.')
    return
  }

  if (newSession) {
    await clearDovetailSession()
    // Allow the new WebSocket session to connect before sending
    await new Promise(r => setTimeout(r, 1500))
  }

  await shadowDOMTrigger(intentText)
}
