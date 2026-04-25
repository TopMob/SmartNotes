import test from 'node:test'
import assert from 'node:assert/strict'

const runtimeConfig = {
  url: 'https://example.supabase.co',
  publishableKey: 'public-anon-key',
  googleClientId: ''
}

function createJwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`
}

function createSession({ sub = 'user-1', email = 'user@example.com', exp = Math.floor(Date.now() / 1000) + 3600, accessToken, refreshToken = 'refresh-token', expiresAt = exp } = {}) {
  return {
    access_token: accessToken || createJwt({ sub, email, exp }),
    refresh_token: refreshToken,
    token_type: 'bearer',
    expires_in: Math.max(0, exp - Math.floor(Date.now() / 1000)),
    expires_at: expiresAt,
    user: {
      id: sub,
      email,
      user_metadata: {}
    }
  }
}

test('stored session survives reload by forcing refresh when user endpoint rejects stale access token', async () => {
  const storage = new Map()
  const fetchCalls = []
  const staleSession = createSession({ refreshToken: 'refresh-stale' })
  const refreshedSession = createSession({ refreshToken: 'refresh-next', exp: Math.floor(Date.now() / 1000) + 7200 })

  storage.set('smartnotes.supabase.session', JSON.stringify(staleSession))

  globalThis.window = {
    location: {
      href: 'https://smartnotes.local/',
      origin: 'https://smartnotes.local',
      hash: '',
      search: '',
      pathname: '/'
    },
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null
      },
      setItem(key, value) {
        storage.set(key, String(value))
      },
      removeItem(key) {
        storage.delete(key)
      }
    },
    addEventListener() {},
    history: {
      replaceState() {}
    },
    SmartNotesSupabaseConfig: runtimeConfig
  }
  globalThis.document = {
    title: 'SmartNotes',
    visibilityState: 'visible'
  }
  globalThis.atob = (value) => Buffer.from(value, 'base64').toString('binary')
  globalThis.fetch = async (input, init = {}) => {
    fetchCalls.push({ input: String(input), method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null })

    if (String(input) === '/api/supabase/auth') {
      const body = init.body ? JSON.parse(init.body) : {}
      if (body.path === 'user') {
        if (body.accessToken === staleSession.access_token) {
          return new Response(JSON.stringify({ error: 'jwt expired', code: 'bad_jwt' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        if (body.accessToken === refreshedSession.access_token) {
          return new Response(JSON.stringify({
            user: {
              id: 'user-1',
              email: 'user@example.com',
              user_metadata: {}
            }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }

      if (body.path === 'token?grant_type=refresh_token') {
        assert.equal(body.body.refresh_token, 'refresh-stale')
        return new Response(JSON.stringify(refreshedSession), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    throw new Error(`Unexpected fetch: ${String(input)}`)
  }

  const module = await import(`../public/js/core/supabase.js?test=${Date.now()}`)
  window.__smartnotesSupabaseTestUtils.reset()

  const client = module.initSupabase()
  const initialResult = await client.auth.getSession()
  const initialSession = initialResult?.data?.session || null

  assert.ok(initialSession)
  assert.equal(initialSession.refresh_token, 'refresh-stale')

  await new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('session refresh not observed')), 200)
    const subscription = client.auth.onAuthStateChange((eventName, session) => {
      if (eventName !== 'USER_VERIFIED' && eventName !== 'TOKEN_REFRESHED') return
      clearTimeout(timeoutId)
      subscription?.data?.subscription?.unsubscribe?.()
      try {
        assert.ok(session)
        assert.equal(session.refresh_token, 'refresh-next')
        assert.equal(session.user?.id, 'user-1')
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  })

  const persisted = JSON.parse(storage.get('smartnotes.supabase.session'))
  assert.equal(persisted.refresh_token, 'refresh-next')
  assert.ok(fetchCalls.some(call => call.body?.path === 'token?grant_type=refresh_token'))

  window.__smartnotesSupabaseTestUtils.reset()
  delete globalThis.window
  delete globalThis.document
  delete globalThis.fetch
})

test('stored session is preserved on reload when profile verification temporarily fails', async () => {
  const storage = new Map()
  const fetchCalls = []
  const storedSession = createSession({ refreshToken: 'refresh-stable', exp: Math.floor(Date.now() / 1000) + 7200 })

  storage.set('smartnotes.supabase.session', JSON.stringify(storedSession))

  globalThis.window = {
    location: {
      href: 'https://smartnotes.local/',
      origin: 'https://smartnotes.local',
      hash: '',
      search: '',
      pathname: '/'
    },
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null
      },
      setItem(key, value) {
        storage.set(key, String(value))
      },
      removeItem(key) {
        storage.delete(key)
      }
    },
    addEventListener() {},
    history: {
      replaceState() {}
    },
    SmartNotesSupabaseConfig: runtimeConfig
  }
  globalThis.document = {
    title: 'SmartNotes',
    visibilityState: 'visible'
  }
  globalThis.atob = (value) => Buffer.from(value, 'base64').toString('binary')
  globalThis.fetch = async (input, init = {}) => {
    fetchCalls.push({ input: String(input), method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null })

    if (String(input) === '/api/supabase/auth') {
      const body = init.body ? JSON.parse(init.body) : {}
      if (body.path === 'user') {
        return new Response(JSON.stringify({ error: 'temporary upstream outage' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    throw new Error(`Unexpected fetch: ${String(input)}`)
  }

  const module = await import(`../public/js/core/supabase.js?test-preserve=${Date.now()}`)
  window.__smartnotesSupabaseTestUtils.reset()

  const client = module.initSupabase()
  const initialResult = await client.auth.getSession()
  const initialSession = initialResult?.data?.session || null

  assert.ok(initialSession)
  assert.equal(initialSession.access_token, storedSession.access_token)
  assert.equal(initialSession.refresh_token, 'refresh-stable')
  assert.equal(JSON.parse(storage.get('smartnotes.supabase.session')).refresh_token, 'refresh-stable')
  const persisted = JSON.parse(storage.get('smartnotes.supabase.session'))
  assert.equal(persisted.access_token, storedSession.access_token)
  assert.equal(persisted.refresh_token, 'refresh-stable')

  window.__smartnotesSupabaseTestUtils.reset()
  delete globalThis.window
  delete globalThis.document
  delete globalThis.fetch
})

test('expired stored session is preserved during temporary refresh outage until a real auth failure occurs', async () => {
  const storage = new Map()
  const expiredSession = createSession({
    refreshToken: 'refresh-survives',
    exp: Math.floor(Date.now() / 1000) - 60,
    expiresAt: Math.floor(Date.now() / 1000) - 60
  })

  storage.set('smartnotes.supabase.session', JSON.stringify(expiredSession))

  globalThis.window = {
    location: {
      href: 'https://smartnotes.local/',
      origin: 'https://smartnotes.local',
      hash: '',
      search: '',
      pathname: '/'
    },
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null
      },
      setItem(key, value) {
        storage.set(key, String(value))
      },
      removeItem(key) {
        storage.delete(key)
      }
    },
    addEventListener() {},
    history: {
      replaceState() {}
    },
    SmartNotesSupabaseConfig: runtimeConfig
  }
  globalThis.document = {
    title: 'SmartNotes',
    visibilityState: 'visible'
  }
  globalThis.atob = (value) => Buffer.from(value, 'base64').toString('binary')
  globalThis.fetch = async (input, init = {}) => {
    if (String(input) === '/api/supabase/auth') {
      const body = init.body ? JSON.parse(init.body) : {}
      if (body.path === 'token?grant_type=refresh_token') {
        return new Response(JSON.stringify({ error: 'temporary outage' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    throw new Error(`Unexpected fetch: ${String(input)}`)
  }

  const module = await import(`../public/js/core/supabase.js?test-expired=${Date.now()}`)
  window.__smartnotesSupabaseTestUtils.reset()

  const client = module.initSupabase()
  const result = await client.auth.getSession()
  const session = result?.data?.session || null

  assert.ok(session)
  assert.equal(session.refresh_token, 'refresh-survives')
  assert.equal(JSON.parse(storage.get('smartnotes.supabase.session')).refresh_token, 'refresh-survives')

  window.__smartnotesSupabaseTestUtils.reset()
  delete globalThis.window
  delete globalThis.document
  delete globalThis.fetch
})
