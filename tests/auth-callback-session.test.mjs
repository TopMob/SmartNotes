import test from 'node:test'
import assert from 'node:assert/strict'

test('auth callback waits until oauth session becomes available', async () => {
  const timers = []
  const originalSetTimeout = globalThis.setTimeout
  const originalDateNow = Date.now

  let now = 0
  Date.now = () => now
  globalThis.setTimeout = (callback, delay) => {
    const timer = { callback, delay }
    timers.push(timer)
    now += Number(delay || 0)
    Promise.resolve().then(callback)
    return timer
  }

  const getSessionCalls = []
  const sessions = [null, null, { access_token: 'token-1' }]
  const supabase = {
    auth: {
      async getSession() {
        getSessionCalls.push(true)
        return {
          data: {
            session: sessions.shift() || null
          },
          error: null
        }
      }
    }
  }

  globalThis.window = {
    setTimeout: globalThis.setTimeout
  }

  async function waitForOAuthSession() {
    const SESSION_WAIT_TIMEOUT_MS = 12000
    const SESSION_WAIT_INTERVAL_MS = 150
    const startedAt = Date.now()

    while (Date.now() - startedAt < SESSION_WAIT_TIMEOUT_MS) {
      const sessionResult = await supabase.auth.getSession()
      const session = sessionResult.data.session

      if (session?.access_token) {
        return session
      }

      await new Promise((resolve) => window.setTimeout(resolve, SESSION_WAIT_INTERVAL_MS))
    }

    throw new Error('oauth-session-timeout')
  }

  const session = await waitForOAuthSession()

  assert.equal(session.access_token, 'token-1')
  assert.equal(getSessionCalls.length, 3)
  assert.equal(timers.length, 2)
  assert.equal(timers[0].delay, 150)

  globalThis.setTimeout = originalSetTimeout
  Date.now = originalDateNow
  delete globalThis.window
})
