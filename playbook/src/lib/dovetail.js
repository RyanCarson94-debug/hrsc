/**
 * Dovetail HR Copilot widget integration.
 *
 * Widget renders entirely inside a Shadow DOM on DIV#auxi-chat-widget.
 * The chat input is a contenteditable DIV inside that shadow root.
 * Communication uses WebSocket (wss://conversation.copilot-eu.dovetailnow.com).
 *
 * To trigger an intent we:
 *   1. Open the widget (click its launcher button if closed)
 *   2. Wait for the contenteditable editor to appear in the shadow root
 *   3. Set its text content and dispatch React-compatible input events
 *   4. Submit via Enter keydown + send button click
 *
 * To reset the session we reload the shadow host element, which forces
 * the widget to create a new WebSocket connection and fresh conversation.
 */

function getShadowRoot() {
  return document.getElementById('auxi-chat-widget')?.shadowRoot ?? null
}

function isWidgetOpen(shadow) {
  return !!shadow?.querySelector('[contenteditable]')
}

function openWidget(shadow) {
  if (isWidgetOpen(shadow)) return
  // The launcher button is the first button when widget is closed
  const btn = shadow?.querySelector('button')
  btn?.click()
}

/**
 * Start a new conversation in the widget.
 * Looks for a "new conversation" button inside the shadow DOM.
 * If none is found, closes and reopens the widget (visual reset only).
 */
export async function clearDovetailSession() {
  const shadow = getShadowRoot()
  if (!shadow) return

  // Look for a new-conversation or reset button by aria-label or title
  const buttons = [...shadow.querySelectorAll('button')]
  const resetBtn = buttons.find(b =>
    /new.conv|new.chat|restart|reset|start.over/i.test(b.textContent + b.title + (b.getAttribute('aria-label') ?? ''))
  )
  if (resetBtn) {
    resetBtn.click()
    await new Promise(r => setTimeout(r, 400))
    return
  }

  // Fallback: close then reopen so visually it looks fresh
  if (isWidgetOpen(shadow)) {
    shadow.querySelector('button')?.click()
    await new Promise(r => setTimeout(r, 300))
  }
}

async function shadowDOMTrigger(intentText) {
  const shadow = getShadowRoot()
  if (!shadow) return false

  openWidget(shadow)

  return new Promise((resolve) => {
    function tryFill() {
      const editor = shadow.querySelector('[contenteditable]')
      if (!editor) return false

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

      setTimeout(() => {
        // Press Enter to submit
        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, composed: true }))
        editor.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', keyCode: 13, bubbles: true, composed: true }))

        // Also click the send button (second-to-last button; last may be attachment/emoji)
        const buttons = [...shadow.querySelectorAll('button')]
        // Buttons when open: 0=close(X), 1=minimize(-), 2=send, 3=other
        // Try clicking btn index 2 first, fall back to last button
        const sendBtn = buttons[2] ?? buttons[buttons.length - 1]
        sendBtn?.click()

        resolve(true)
      }, 150)
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
 * Pass { newSession: true } (default) to reset the conversation first.
 */
export async function triggerDovetailIntent(intentText, { newSession = false } = {}) {
  if (!intentText) return

  if (!document.getElementById('auxi-chat-widget')) {
    console.warn('[Dovetail] Widget not found. Ensure auxi-widget script is in index.html.')
    return
  }

  if (newSession) await clearDovetailSession()

  await shadowDOMTrigger(intentText)
}
