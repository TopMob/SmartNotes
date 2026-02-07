import { useEffect, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useTranslation } from 'react-i18next'

const toolbarButtons = [
  { label: 'B', action: 'toggleBold' },
  { label: 'I', action: 'toggleItalic' },
  { label: 'S', action: 'toggleStrike' },
  { label: 'H1', action: 'toggleHeading', options: { level: 1 } },
  { label: 'H2', action: 'toggleHeading', options: { level: 2 } },
  { label: '•', action: 'toggleBulletList' },
  { label: '1.', action: 'toggleOrderedList' },
  { label: '"', action: 'toggleBlockquote' }
]

export default function Editor({ note, onSave, onClose }) {
  const [title, setTitle] = useState(note?.title || '')
  const { t } = useTranslation()

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: t('editor.contentPlaceholder')
      })
    ],
    content: note?.content || ''
  })

  useEffect(() => {
    setTitle(note?.title || '')
    if (editor) {
      editor.commands.setContent(note?.content || '', false)
    }
  }, [note, editor])

  if (!editor) {
    return null
  }

  const handleSave = () => {
    const content = editor.getHTML()
    onSave({
      ...note,
      title,
      content
    })
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-4xl rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('editor.titlePlaceholder')}
            className="w-full flex-1 bg-transparent text-2xl font-semibold text-white outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
            >
              {t('editor.close')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
            >
              {t('editor.save')}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {toolbarButtons.map((button) => (
            <button
              key={button.label}
              type="button"
              onClick={() => editor.chain().focus()[button.action](button.options || {}).run()}
              className="rounded-lg border border-slate-800 px-3 py-1 text-sm text-slate-200 hover:border-slate-600"
            >
              {button.label}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
