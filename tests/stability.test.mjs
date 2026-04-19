import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_BACKEND_BASE_URL, normalizeBaseUrl, resolveBackendBaseUrl, createApiEndpoint } from '../public/js/core/backendConfig.js'

test('normalizeBaseUrl trims spaces and trailing slash', () => {
    assert.equal(normalizeBaseUrl(' https://example.com/// '), 'https://example.com')
})

test('resolveBackendBaseUrl returns explicit override first', () => {
    assert.equal(resolveBackendBaseUrl({ backendBaseUrl: 'https://custom-host.dev/' }), 'https://custom-host.dev')
})

test('resolveBackendBaseUrl falls back to default without browser globals', () => {
    assert.equal(resolveBackendBaseUrl({}), DEFAULT_BACKEND_BASE_URL)
})

test('createApiEndpoint builds stable endpoint path', () => {
    assert.equal(createApiEndpoint('/drive/status', { backendBaseUrl: 'https://api.smartnotes.test/' }), 'https://api.smartnotes.test/api/drive/status')
})

