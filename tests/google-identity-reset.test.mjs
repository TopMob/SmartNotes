import test from 'node:test'
import assert from 'node:assert/strict'

test('resetGoogleIdentitySession disables auto select and cancels prompt', async () => {
  let cancelCalls = 0
  let disableAutoSelectCalls = 0

  globalThis.window = {
    google: {
      accounts: {
        id: {
          cancel() {
            cancelCalls += 1
          },
          disableAutoSelect() {
            disableAutoSelectCalls += 1
          }
        }
      }
    }
  }
  globalThis.document = {
    querySelector() {
      return null
    },
    createElement() {
      return {
        addEventListener() {},
        remove() {}
      }
    },
    head: {
      appendChild() {}
    }
  }

  const { resetGoogleIdentitySession } = await import(`../public/js/core/googleIdentityAuth.js?test-google-reset=${Date.now()}`)
  const result = await resetGoogleIdentitySession()

  assert.equal(result, true)
  assert.equal(cancelCalls, 1)
  assert.equal(disableAutoSelectCalls, 1)

  delete globalThis.window
  delete globalThis.document
})

test('google identity script can be retried after timeout', async () => {
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const scheduledTimers = []

  globalThis.setTimeout = (callback, _delay) => {
    const timer = { callback, cleared: false }
    scheduledTimers.push(timer)
    return timer
  }
  globalThis.clearTimeout = (timer) => {
    if (timer) timer.cleared = true
  }

  let scriptLoadAttempt = 0
  globalThis.window = {}
  globalThis.document = {
    querySelector() {
      return null
    },
    createElement() {
      const listeners = new Map()
      return {
        src: '',
        async: false,
        defer: false,
        addEventListener(type, handler) {
          listeners.set(type, handler)
        },
        remove() {},
        trigger(type) {
          listeners.get(type)?.()
        }
      }
    },
    head: {
      appendChild(scriptElement) {
        scriptLoadAttempt += 1
        if (scriptLoadAttempt === 1) {
          Promise.resolve().then(() => {
            scheduledTimers.at(-1)?.callback()
          })
          return
        }
        if (scriptLoadAttempt === 2) {
          window.google = {
            accounts: {
              id: {
                initialize() {},
                prompt() {}
              }
            }
          }
          Promise.resolve().then(() => scriptElement.trigger('load'))
        }
      }
    }
  }

  const module = await import(`../public/js/core/googleIdentityAuth.js?test-google-timeout=${Date.now()}`)

  const firstAttempt = await module.preloadGoogleIdentity({ clientId: 'client-id' })
  assert.equal(firstAttempt, false)

  const result = await module.preloadGoogleIdentity({ clientId: 'client-id' })

  assert.equal(result, true)
  assert.equal(scriptLoadAttempt, 2)

  globalThis.setTimeout = originalSetTimeout
  globalThis.clearTimeout = originalClearTimeout
  delete globalThis.window
  delete globalThis.document
})
