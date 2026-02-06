import { useEffect, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered, Quote } from "lucide-react";
import { useNotesStore } from "../store/useNotesStore";

const toolbarButton =
  "inline-flex items-center justify-center rounded-lg border border-slate-800 px-2 py-1 text-xs font-medium text-slate-200 transition hover:border-slate-700 hover:bg-slate-800";

export default function NoteEditor() {
  const activeId = useNotesStore((state) => state.activeId);
  const note = useNotesStore((state) => state.getActiveNote());
  const updateNote = useNotesStore((state) => state.updateNote);

  const editor = useEditor({
    extensions: [StarterKit],
    content: note?.content ?? "<p>" + "" + "</p>",
    onUpdate: ({ editor: nextEditor }) => {
      if (!activeId) return;
      updateNote(activeId, { content: nextEditor.getHTML() });
    },
  });

  const toolbarActions = useMemo(
    () => [
      {
        label: "Bold",
        icon: Bold,
        onClick: () => editor?.chain().focus().toggleBold().run(),
        active: editor?.isActive("bold"),
      },
      {
        label: "Italic",
        icon: Italic,
        onClick: () => editor?.chain().focus().toggleItalic().run(),
        active: editor?.isActive("italic"),
      },
      {
        label: "Bullet List",
        icon: List,
        onClick: () => editor?.chain().focus().toggleBulletList().run(),
        active: editor?.isActive("bulletList"),
      },
      {
        label: "Ordered List",
        icon: ListOrdered,
        onClick: () => editor?.chain().focus().toggleOrderedList().run(),
        active: editor?.isActive("orderedList"),
      },
      {
        label: "Quote",
        icon: Quote,
        onClick: () => editor?.chain().focus().toggleBlockquote().run(),
        active: editor?.isActive("blockquote"),
      },
    ],
    [editor]
  );

  useEffect(() => {
    if (!editor) return;
    if (!note) return;
    const html = note.content ?? "<p></p>";
    editor.commands.setContent(html, false);
  }, [note?.id, note?.content, editor, note]);

  if (!note) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-8 text-center text-slate-400">
        Выберите заметку или создайте новую.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-2">
        {toolbarActions.map(({ label, icon: Icon, onClick, active }) => (
          <button
            key={label}
            type="button"
            className={`${toolbarButton} ${active ? "bg-slate-800" : ""}`}
            onClick={onClick}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
