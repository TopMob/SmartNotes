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
