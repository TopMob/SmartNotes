import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readText = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('P0 startup path no longer loads heavy editor scripts directly from index.html', async () => {
  const indexHtml = await readText('index.html')
  assert.match(indexHtml, /js\/editor\/bootstrap\.js\?v=/)
  assert.doesNotMatch(indexHtml, /js\/editor\/drawing-engine\.js\?v=/)
  assert.doesNotMatch(indexHtml, /js\/editor\/drawing\.js\?v=/)
  assert.doesNotMatch(indexHtml, /js\/editor\/core\.js\?v=/)
})

test('P0 editor runtime is lazy-loaded through runtime loader and proxy bootstrap', async () => {
  const bootstrap = await readText('js/editor/bootstrap.js')
  const runtimeLoader = await readText('js/editor/runtime-loader.js')
  assert.match(bootstrap, /window\.SmartNotesEditor\s*=\s*new Proxy/)
  assert.match(bootstrap, /await ensureEditorRuntimeScripts\(\)/)
  assert.match(bootstrap, /await import\("\.\/core-api\.js"\)/)
  assert.match(runtimeLoader, /const runtimeScripts = \[\s*"drawing-engine\.js",\s*"drawing\.js"\s*\]/)
})

test('P0 cloud calls are deferred and not forced on app bootstrap', async () => {
  const appCode = await readText('js/notes/app.js')
  const authCode = await readText('js/core/auth.js')
  const providerCode = await readText('js/core/externalStorage/providers/googleDrive/provider.js')
  assert.doesNotMatch(appCode, /await SessionService\.startUserSession\(user\)/)
  assert.match(authCode, /hasOAuthRedirectFlag/)
  assert.match(authCode, /syncStatus:\s*shouldSyncExternalMediaStatus/)
  assert.match(providerCode, /const shouldSyncStatus = options\.syncStatus === true/)
  assert.match(providerCode, /if \(!shouldSyncStatus\) \{\s*return this\.getStatus\(\)/)
})
