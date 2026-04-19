import test from 'node:test'
import assert from 'node:assert/strict'
import { createGoogleDriveProvider } from '../public/js/core/externalStorage/providers/googleDrive/provider.js'

test('google drive provider is configured with relative api endpoint', () => {
    const provider = createGoogleDriveProvider()
    const status = provider.getStatus()
    assert.equal(status.configured, true)
})

test('google drive provider is configured with absolute api endpoint', () => {
    const provider = createGoogleDriveProvider({ backendBaseUrl: 'https://api.smartnotes.test' })
    const status = provider.getStatus()
    assert.equal(status.configured, true)
})
