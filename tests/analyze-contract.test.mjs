import test from 'node:test'
import assert from 'node:assert/strict'

import { buildNoteInput, isNoteReadyForAnalysis, buildAnalysisUserContext, selectFolderCandidatesForNote } from '../app/api/analyze/core/contract.js'
import { buildAnalysisPrompt } from '../app/api/analyze/providers/prompt.js'
import { createAnalysisTaskInput } from '../app/api/analyze/providers/schema.js'
import { normalizeAnalyzedItem, safeParseJsonArray } from '../app/api/analyze/providers/utils.js'

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
  assert.match(prompt, /Return a JSON array even when there is only one note\./)
  assert.match(prompt, /## Output Schema/)
  assert.match(prompt, /resurfacingClass/)
  assert.match(prompt, /Folder candidates:/)
  assert.match(prompt, /Notes:/)
})

test('selectFolderCandidatesForNote prioritizes matching folders over generic ones', () => {
    const folders = [
        { id: 'misc', name: 'Разное', description: '', isGeneric: true },
        { id: 'work', name: 'Работа', description: 'Проекты, релизы, задачи', isGeneric: false },
        { id: 'travel', name: 'Путешествия', description: 'Маршруты и билеты', isGeneric: false }
    ]

    const candidates = selectFolderCandidatesForNote(folders, {
        title: 'План релиза',
        cleanText: 'Нужно собрать задачи по проекту и подготовить релиз',
        currentFolderId: null,
        currentUserTags: ['проект'],
        currentHiddenTags: [],
        analyzed: false
    }, 2)

  assert.equal(candidates.length, 2)
  assert.equal(candidates[0].id, 'work')
})

test('safeParseJsonArray accepts wrapped provider arrays', () => {
  const parsed = safeParseJsonArray('{"items":[{"id":"note-1"}]}')
  assert.deepEqual(parsed, [{ id: 'note-1' }])
})

test('safeParseJsonArray accepts a single analyzed object', () => {
  const parsed = safeParseJsonArray('{"id":"note-1","userTags":["project"],"hiddenTags":["release"],"relevance":50,"resurfacingClass":"reference"}')
  assert.deepEqual(parsed, [{
    id: 'note-1',
    userTags: ['project'],
    hiddenTags: ['release'],
    relevance: 50,
    resurfacingClass: 'reference'
  }])
})

test('normalizeAnalyzedItem accepts snake_case provider fields', () => {
  const item = normalizeAnalyzedItem({
    note_id: 'note-1',
    folder_id: 'folder-1',
    user_tags: ['проект'],
    hidden_tags: ['релиз'],
    resurfacing_class: 'idea',
    relevance: 72
  })

  assert.deepEqual(item, {
    id: 'note-1',
    folderId: 'folder-1',
    userTags: ['проект'],
    hiddenTags: ['релиз'],
    relevance: 72,
    resurfacingClass: 'idea'
  })
})
