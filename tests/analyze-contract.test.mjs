import test from 'node:test'
import assert from 'node:assert/strict'

import { buildNoteInput, isNoteReadyForAnalysis, buildAnalysisUserContext } from '../app/api/analyze/core/contract.js'
import { buildAnalysisPrompt } from '../app/api/analyze/providers/prompt.js'
import { createAnalysisTaskInput } from '../app/api/analyze/providers/schema.js'

test('buildNoteInput creates normalized AI contract note payload', () => {
    const document = {
        id: 'note-1',
        data() {
            return {
                title: ' План по проекту ',
                content: '<p>Сделать новую структуру тегов</p>',
                tags: ['Работа', 'проект'],
                hiddenTags: ['архитектура'],
                folderId: 'folder-1',
                analyzed: true,
                sourceType: 'manual',
                language: 'ru'
            }
        }
    }

    const note = buildNoteInput(document, 1200)

    assert.equal(note.id, 'note-1')
    assert.equal(note.title, 'План по проекту')
    assert.equal(note.cleanText, 'Сделать новую структуру тегов')
    assert.equal(note.currentFolderId, 'folder-1')
    assert.deepEqual(note.currentUserTags, ['Работа', 'проект'])
    assert.deepEqual(note.currentHiddenTags, ['архитектура'])
    assert.equal(note.sourceType, 'manual')
    assert.equal(note.language, 'ru')
    assert.equal(note.analyzed, true)
    assert.equal(isNoteReadyForAnalysis(note), true)
})

test('buildAnalysisUserContext returns minimal user context contract', () => {
    const userContext = buildAnalysisUserContext({
        userDocument: {
            data() {
                return { lang: 'ru' }
            }
        }
    })

    assert.deepEqual(userContext, { language: 'ru' })
})

test('buildAnalysisPrompt uses structured English prompt contract', () => {
    const prompt = buildAnalysisPrompt({
        task: createAnalysisTaskInput(),
        userContext: { language: 'ru' },
        folders: [{ id: 'folder-1', name: 'Work', description: 'Project work', isGeneric: false }],
        notes: [{
            id: 'note-1',
            title: 'Plan',
            cleanText: 'Prepare release checklist',
            createdAt: null,
            updatedAt: null,
            currentFolderId: null,
            currentUserTags: [],
            currentHiddenTags: [],
            analyzed: false,
            sourceType: 'note',
            language: 'en',
            charCount: 25
        }]
    })

    assert.match(prompt, /You are a strict note analysis engine for SmartNotes\./)
    assert.match(prompt, /## Output Schema/)
    assert.match(prompt, /resurfacingClass/)
    assert.match(prompt, /Folder candidates:/)
    assert.match(prompt, /Notes:/)
})
