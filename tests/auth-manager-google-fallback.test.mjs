import test from 'node:test'
import assert from 'node:assert/strict'

function createDomElement() {
  return {
    disabled: false,
    attributes: new Map(),
    classList: {
      toggle() {},
      add() {},
      remove() {}
    },
    setAttribute(key, value) {
      this.attributes.set(key, String(value))
    },
    removeAttribute(key) {
      this.attributes.delete(key)
    }
  }
}

function createEnvironment() {
  const authButton = createDomElement()
  const feedbackElement = {
    textContent: '',
    classList: {
      remove() {},
      add() {}
    }
  }

  globalThis.window = {
    hideSplashScreen() {},
    SmartNotesAuthUi: { markReady() {} }
  }
  globalThis.StateActions = {
    setUser() {}
  }
  globalThis.StateStore = {
    resetSession() {},
    read() {
      return {}
    }
  }
  globalThis.SessionService = {
    async startUserSession() {},
    stopUserSession() {}
  }
  globalThis.UI = {
    getText(_key, fallback) {
      return fallback
    },
    showToast() {}
  }
  globalThis.document = {
    getElementById(id) {
      if (id === 'email-auth-feedback') return feedbackElement
      return null
    },
    querySelectorAll() {
      return [authButton]
    }
  }

  return { authButton, feedbackElement }
}

test('google fallback requires a second click after cooldown', async () => {
  const scheduledTimers = []
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const originalDateNow = Date.now
  let now = 1000
  Date.now = () => now
  globalThis.setTimeout = (callback, delay) => {
    const entry = { callback, delay, cleared: false }
    scheduledTimers.push(entry)
    return entry
  }
  globalThis.clearTimeout = (timer) => {
    if (timer) timer.cleared = true
  }

  const { authButton, feedbackElement } = createEnvironment()
  const calls = {
    oneTap: 0,
    redirect: 0
  }

  const auth = {
    currentUser: null,
    Auth: { Persistence: { LOCAL: 'local' } },
    async setPersistence() {
      return true
    },
    async signInWithGoogleOneTap() {
      calls.oneTap += 1
      throw { code: 'auth/google-identity-not-displayed', message: 'not displayed' }
    },
    async signInWithRedirect() {
      calls.redirect += 1
      return { user: null }
    },
    onAuthStateChanged() {
      return () => {}
    },
    async getRedirectResult() {
      return null
    },
    preloadGoogleSignIn() {
      return Promise.resolve(false)
    }
  }

  const { createAuthManager } = await import(`../public/js/core/auth.js?test-auth=${Date.now()}`)
  const manager = createAuthManager({ auth })

  await manager.login()
  assert.equal(calls.oneTap, 1)
  assert.equal(calls.redirect, 0)
  assert.equal(authButton.disabled, true)
  assert.match(feedbackElement.textContent, /подождите 5 секунд|wait 5 seconds/i)
  assert.equal(scheduledTimers.length, 1)
  assert.equal(scheduledTimers[0].delay, 5000)

  await manager.login()
  assert.equal(calls.oneTap, 1)
  assert.equal(calls.redirect, 0)

  scheduledTimers[0].callback()
  now += 5000
  assert.equal(authButton.disabled, false)
  assert.match(feedbackElement.textContent, /нажмите кнопку ещё раз|press the button again/i)

  await manager.login()
  assert.equal(calls.redirect, 1)

  Date.now = originalDateNow
  globalThis.setTimeout = originalSetTimeout
  globalThis.clearTimeout = originalClearTimeout
  delete globalThis.window
  delete globalThis.StateActions
  delete globalThis.StateStore
  delete globalThis.SessionService
  delete globalThis.UI
  delete globalThis.document
})
