import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_BACKEND_BASE_URL, normalizeBaseUrl, resolveBackendBaseUrl, createApiEndpoint } from '../js/core/backendConfig.js'

test('normalizeBaseUrl trims spaces and trailing slash', () => {
    assert.equal(normalizeBaseUrl(' local://example/// '), 'local://example')
})

test('resolveBackendBaseUrl returns explicit override first', () => {
    assert.equal(resolveBackendBaseUrl({ backendBaseUrl: 'local://custom-host/' }), 'local://custom-host')
})

test('resolveBackendBaseUrl falls back to default without browser globals', () => {
    assert.equal(resolveBackendBaseUrl({}), DEFAULT_BACKEND_BASE_URL)
})

test('createApiEndpoint builds stable endpoint path', () => {
    assert.equal(createApiEndpoint('/drive/status', { backendBaseUrl: 'local://smartnotes-runtime/' }), 'local://smartnotes-runtime/api/drive/status')
})
