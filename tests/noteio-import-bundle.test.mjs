import test from 'node:test'
import assert from 'node:assert/strict'

globalThis.StateStore = {
  read() {
    return { user: { uid: 'user-1' } }
  }
}

globalThis.window = {}

globalThis.Utils = {
  serverTimestamp() {
    return new Date('2026-01-01T00:00:00.000Z')
  },
  generateId() {
    return 'generated-id'
  },
  sanitizeHtml(value) {
    return String(value || '')
  }
}

await import(`../public/js/load-services.js?test-noteio=${Date.now()}`)

const noteIo = globalThis.window.NoteIO

test('parseImportBundle extracts notes and folders together', () => {
  const bundle = noteIo.parseImportBundle({
    folders: [
      { id: 'folder-a', name: 'Work', description: 'Project notes', folderOrder: 3, isHidden: false }
    ],
    notes: [
      { id: 'note-a', title: 'Plan', content: '<p>Alpha</p>', folderId: 'folder-a' }
    ]
  })

  assert.equal(bundle.folders.length, 1)
  assert.equal(bundle.notes.length, 1)
  assert.equal(bundle.folders[0].id, 'folder-a')
  assert.equal(bundle.folders[0].name, 'Work')
  assert.equal(bundle.notes[0].folderId, 'folder-a')
})

test('parseImportBundle supports nested folder containers', () => {
  const bundle = noteIo.parseImportBundle({
    payload: {
      groups: [
        { id: 'folder-b', name: 'Ideas', description: 'Brainstorm', isHidden: true }
      ],
      items: [
        { id: 'note-b', name: 'Spark', text: 'Idea text', folder_id: 'folder-b' }
      ]
    }
  })

  assert.equal(bundle.folders.length, 1)
  assert.equal(bundle.folders[0].id, 'folder-b')
  assert.equal(bundle.folders[0].isHidden, true)
  assert.equal(bundle.notes.length, 1)
  assert.equal(bundle.notes[0].folderId, 'folder-b')
})
