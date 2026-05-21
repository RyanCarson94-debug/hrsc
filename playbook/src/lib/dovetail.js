/**
 * Dovetail HR Copilot widget integration.
 *
 * ─── HOW TO FIND THE EXACT API ────────────────────────────────────────────────
 * Open your browser DevTools console on any page where the widget is loaded,
 * then paste and run the snippet below. It will tell you exactly which
 * strategy to use and what to update in triggerIntent() below.
 *
 *   (function () {
 *     console.group('Dovetail widget inspector');
 *
 *     // 1. Scan window globals
 *     const hits = Object.keys(window).filter(k =>
 *       /auxi|dovetail|copilot|chat|widget/i.test(k) && window[k] && typeof window[k] === 'object'
 *     );
 *     console.log('Matching window globals:', hits.length ? hits : 'none found');
 *     hits.forEach(k => { try { console.log(k, '→', Object.keys(window[k])); } catch {} });
 *
 *     // 2. Scan iframes
 *     const frames = [...document.querySelectorAll('iframe')];
 *     console.log('iframes:', frames.map(f => ({ id: f.id, src: f.src.slice(0, 80) })));
 *
 *     // 3. Scan shadow DOM
 *     const shadows = [...document.querySelectorAll('*')].filter(el => el.shadowRoot);
 *     console.log('shadow roots:', shadows.map(el => `${el.tagName}#${el.id}`));
 *
 *     // 4. Listen for postMessages from widget
 *     const handler = e => { if (e.data) console.log('postMessage from', e.origin, e.data); };
 *     window.addEventListener('message', handler);
 *     console.log('postMessage listener attached — interact with the widget now');
 *     window.__dvCleanup = () => window.removeEventListener('message', handler);
 *
 *     // 5. Try common open APIs
 *     ['auxi','AuxiWidget','auxiWidget','dovetail','Dovetail','copilot'].forEach(name => {
 *       const api = window[name];
 *       if (!api) return;
 *       ['open','show','trigger','start'].forEach(m => {
 *         if (typeof api[m] === 'function') {
 *           console.log(`✅ window.${name}.${m}() exists — try calling it`);
 *         }
 *       });
 *     });
 *
 *     console.groupEnd();
 *   })();
 *
 * ─── AFTER INSPECTING ────────────────────────────────────────────────────────
 * Update CONFIRMED_TRIGGER below with the method that works, then the
 * multi-strategy fallback loop will use it first on every call.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const WIDGET_ORIGIN = 'https://chat.copilot-eu.dovetailnow.com'

// Set this once you've confirmed the API via the inspector above.
// e.g. 'window.auxi.send' or 'postMessage' or 'domFallback'
const CONFIRMED_TRIGGER = null

// Global API names the widget might expose
const GLOBAL_NAMES = ['auxi', 'AuxiWidget', 'auxiWidget', 'dovetail', 'Dovetail', 'copilot', 'Copilot']

function findWidgetGlobal() {
  for (const name of GLOBAL_NAMES) {
    if (window[name] && typeof window[name] === 'object') return { name, api: window[name] }
  }
  return null
}

// Set this to the exact localStorage/sessionStorage key prefix once confirmed
// via the browser console snippet at the top of this file.
// e.g. 'auxi_session' or 'dovetail_chat'
const CONFIRMED_SESSION_KEY = null

/**
 * Clear the widget's session so the next trigger starts a fresh conversation.
 * Tries API reset methods first, then wipes known storage keys, then reloads the iframe.
 */
export async function clearDovetailSession() {
  // Strategy 1: API reset method
  const found = findWidgetGlobal()
  if (found) {
    const { api } = found
    const resetMethods = ['reset', 'newConversation', 'clearSession', 'restart', 'clear', 'end']
    for (const m of resetMethods) {
      if (typeof api[m] === 'function') {
        try { api[m](); return } catch {}
      }
    }
  }

  // Strategy 2: Clear storage keys
  const pattern = /auxi|dovetail|copilot|chat_session|chatbot/i
  for (const store of [localStorage, sessionStorage]) {
    try {
      const keys = Object.keys(store).filter(k =>
        CONFIRMED_SESSION_KEY ? k.startsWith(CONFIRMED_SESSION_KEY) : pattern.test(k)
      )
      keys.forEach(k => store.removeItem(k))
    } catch {}
  }

  // Strategy 3: Reload the iframe (forces a clean session)
  const iframe = findWidgetIframe()
  if (iframe) {
    // Reassigning src reloads the frame
    const src = iframe.src
    iframe.src = ''
    await new Promise(r => setTimeout(r, 50))
    iframe.src = src
    // Wait for it to reload before continuing
    await new Promise(r => setTimeout(r, 800))
  }
}



async function tryGlobalAPI(intentText) {
  const found = findWidgetGlobal()
  if (!found) return false
  const { api } = found

  // Ordered from most specific to most generic
  const attempts = [
    () => api.sendMessage?.(intentText),
    () => api.send?.(intentText),
    () => api.chat?.(intentText),
    () => api.trigger?.({ intent: intentText }),
    () => api.trigger?.(intentText),
    () => api.startConversation?.(intentText),
    () => { api.open?.(); api.sendMessage?.(intentText) },
    () => { api.show?.(); api.send?.(intentText) },
  ]

  for (const attempt of attempts) {
    try {
      const result = attempt()
      if (result !== undefined) return true
    } catch {}
  }
  return false
}

function tryPostMessage(intentText) {
  const iframe = findWidgetIframe()
  if (!iframe?.contentWindow) return false

  const payloads = [
    { type: 'SEND_MESSAGE',    message: intentText },
    { type: 'TRIGGER_INTENT',  intent: intentText },
    { type: 'OPEN_CHAT',       message: intentText },
    { type: 'auxi:send',       payload: intentText },
    { action: 'sendMessage',   message: intentText },
    { event: 'trigger',        data: { intent: intentText } },
  ]
  for (const payload of payloads) {
    iframe.contentWindow.postMessage(payload, WIDGET_ORIGIN)
    iframe.contentWindow.postMessage(payload, '*')
  }
  return true
}

function tryCustomEvents(intentText) {
  const scriptEl = document.getElementById('auxi-widget')
  const targets = [scriptEl, document.body, document].filter(Boolean)

  const events = [
    new CustomEvent('auxi:trigger',    { bubbles: true, detail: { intent: intentText } }),
    new CustomEvent('auxi:send',       { bubbles: true, detail: { message: intentText } }),
    new CustomEvent('auxi:open',       { bubbles: true, detail: { message: intentText } }),
    new CustomEvent('copilot:trigger', { bubbles: true, detail: { intent: intentText } }),
  ]
  for (const target of targets) {
    for (const event of events) {
      target.dispatchEvent(event)
    }
  }
}

async function domFallback(intentText) {
  // Step 1: open the widget if it has a toggle button
  const toggleSelectors = [
    '#auxi-widget-toggle',
    '[id*="auxi"] button',
    '[class*="auxi-toggle"]',
    '[class*="chat-toggle"]',
    '[aria-label*="chat" i]',
    '[aria-label*="copilot" i]',
  ]
  for (const sel of toggleSelectors) {
    const btn = document.querySelector(sel)
    if (btn) { btn.click(); break }
  }

  // Step 2: wait up to 3s for an input field to appear
  return new Promise((resolve) => {
    const inputSelectors = [
      '[id*="auxi"] input[type="text"]',
      '[id*="auxi"] textarea',
      '[class*="auxi"] input[type="text"]',
      '[class*="auxi"] textarea',
      '[class*="chat-input"]',
      '[placeholder*="message" i]',
      '[placeholder*="ask" i]',
    ]

    function tryFillInput() {
      for (const sel of inputSelectors) {
        const input = document.querySelector(sel)
        if (!input) continue

        input.focus()
        // Use React's internal value setter so onChange fires
        const nativeSetter = Object.getOwnPropertyDescriptor(
          input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
          'value'
        )?.set
        nativeSetter?.call(input, intentText)
        input.dispatchEvent(new Event('input',  { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        // Submit after a brief tick
        setTimeout(() => {
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }))
          input.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', keyCode: 13, bubbles: true }))
          input.form?.requestSubmit?.()
        }, 120)
        return true
      }
      return false
    }

    if (tryFillInput()) { resolve(); return }

    const observer = new MutationObserver(() => {
      if (tryFillInput()) { observer.disconnect(); resolve() }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => { observer.disconnect(); resolve() }, 3000)
  })
}

/**
 * Trigger a Dovetail Copilot intent by name.
 * Pass { newSession: true } to clear the previous conversation first.
 * Tries strategies in order: confirmed → global API → postMessage → DOM events → DOM fallback.
 */
export async function triggerDovetailIntent(intentText, { newSession = true } = {}) {
  if (!intentText) return

  if (!document.getElementById('auxi-widget')) {
    console.warn('[Dovetail] Widget script not found on page. Add it to playbook/index.html.')
    return
  }

  if (newSession) await clearDovetailSession()

  // Use confirmed strategy immediately if set
  if (CONFIRMED_TRIGGER === 'postMessage') { tryPostMessage(intentText); return }
  if (CONFIRMED_TRIGGER === 'domFallback') { await domFallback(intentText); return }
  if (CONFIRMED_TRIGGER?.startsWith('window.')) {
    // e.g. CONFIRMED_TRIGGER = 'window.auxi.send'
    const [, obj, method] = CONFIRMED_TRIGGER.split('.')
    try { window[obj]?.[method]?.(intentText); return } catch {}
  }

  // Multi-strategy fallback
  if (await tryGlobalAPI(intentText)) return
  if (tryPostMessage(intentText)) return
  tryCustomEvents(intentText)
  await domFallback(intentText)
}
