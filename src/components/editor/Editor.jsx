import { useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Bold, Italic, List, ListOrdered, Quote, Redo, Undo } from "lucide-react"

const actions = [
  { label: "bold", icon: Bold, command: (editor) => editor.chain().focus().toggleBold().run() },
  { label: "italic", icon: Italic, command: (editor) => editor.chain().focus().toggleItalic().run() },
  { label: "bullet", icon: List, command: (editor) => editor.chain().focus().toggleBulletList().run() },
  { label: "ordered", icon: ListOrdered, command: (editor) => editor.chain().focus().toggleOrderedList().run() },
  { label: "quote", icon: Quote, command: (editor) => editor.chain().focus().toggleBlockquote().run() },
  { label: "undo", icon: Undo, command: (editor) => editor.chain().focus().undo().run() },
  { label: "redo", icon: Redo, command: (editor) => editor.chain().focus().redo().run() }
]

export default function Editor({ initialContent, onSave }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent || ""
  })

  useEffect(() => {
    if (editor && initialContent !== undefined) {
      editor.commands.setContent(initialContent || "")
    }
  }, [editor, initialContent])

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => {
              if (!editor) return
              action.command(editor)
            }}
            className="rounded-lg border border-slate-800 p-2 text-slate-300 transition hover:bg-slate-800"
          >
            <action.icon className="h-4 w-4" />
          </button>
        ))}
        <button
          onClick={() => onSave(editor?.getHTML() || "")}
          className="ml-auto rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
        >
          Save
        </button>
      </div>
      <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <EditorContent editor={editor} className="prose prose-invert max-w-none" />
      </div>
    </div>
  )
}
