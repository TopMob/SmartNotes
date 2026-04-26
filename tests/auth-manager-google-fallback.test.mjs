import test from 'node:test'
import assert from 'node:assert/strict'

function createDomElement() {
  return {
    disabled: false,
    style: {},
    textContent: '',
    attributes: new Map(),
    classList: {
      values: new Set(),
      toggle() {},
      add(value) {
        this.values.add(value)
      },
      remove(value) {
        this.values.delete(value)
      }
    },
    setAttribute(key, value) {
      this.attributes.set(key, String(value))
    },
    removeAttribute(key) {
      this.attributes.delete(key)
    },
    addEventListener() {
      return undefined
    }
  }
}

function createEnvironment() {
  const authButton = createDomElement()
  const loginScreen = createDomElement()
  const appScreen = createDomElement()
  const searchInput = { value: 'query' }
  const feedbackElement = {
    textContent: '',
    classList: {
      toggle() {},
      remove() {},
      add() {}
    }
  }

  globalThis.window = {
    hideSplashScreen() {},
    SmartNotesAuthUi: { markReady() {} }
  }
  globalThis.HTMLElement = class HTMLElement {}
  globalThis.StateActions = {
    calls: [],
    setUser(user) {
      this.calls.push(user)
    }
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
      if (id === 'login-screen') return loginScreen
      if (id === 'app') return appScreen
      if (id === 'search-input') return searchInput
      return null
    },
    querySelectorAll() {
      return [authButton]
    }
  }

  loginScreen.style = {}
  appScreen.style = {}

  return { authButton, feedbackElement, loginScreen, appScreen, searchInput }
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
  delete globalThis.HTMLElement
  delete globalThis.StateActions
  delete globalThis.StateStore
  delete globalThis.SessionService
  delete globalThis.UI
  delete globalThis.document
})

test('logout updates UI immediately even without auth callback', async () => {
  const { loginScreen, appScreen, searchInput } = createEnvironment()
  let stopUserSessionCalls = 0
  let authStateCallback = null

  globalThis.SessionService = {
    async startUserSession() {},
    stopUserSession() {
      stopUserSessionCalls += 1
    }
  }

  const auth = {
    currentUser: {
      uid: 'user-1',
      email: 'user@example.com'
    },
    Auth: { Persistence: { LOCAL: 'local' } },
    async setPersistence() {
      return true
    },
    async signOut() {
      this.currentUser = null
      return true
    },
    onAuthStateChanged(callback) {
      authStateCallback = callback
      return () => {}
    },
    async getRedirectResult() {
      return null
    },
    preloadGoogleSignIn() {
      return Promise.resolve(false)
    }
  }

  const { createAuthManager } = await import(`../public/js/core/auth.js?test-auth-logout=${Date.now()}`)
  const manager = createAuthManager({ auth })

  await manager.init()
  await authStateCallback?.(auth.currentUser)

  await manager.logout()

  assert.equal(appScreen.style.display, 'none')
  assert.equal(loginScreen.style.display, 'flex')
  assert.equal(searchInput.value, '')
  assert.equal(stopUserSessionCalls, 1)
  assert.equal(globalThis.StateActions.calls.at(-1), null)

  delete globalThis.window
  delete globalThis.HTMLElement
  delete globalThis.StateActions
  delete globalThis.StateStore
  delete globalThis.SessionService
  delete globalThis.UI
  delete globalThis.document
})
