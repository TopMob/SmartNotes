import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { cn } from "../lib/utils";

const ToolbarButton = ({ active, onClick, children, label }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className={cn(
      "rounded-lg border px-2 py-1 text-slate-200 transition",
      active ? "border-slate-500 bg-slate-800" : "border-slate-800"
    )}
  >
    {children}
  </button>
);

const Editor = () => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: "<p>Начните писать здесь...</p>",
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none min-h-[200px] focus:outline-none"
      }
    }
  });

  if (!editor) return null;

  return (
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap gap-2">
        <ToolbarButton
          label="Жирный"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Курсив"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Маркированный список"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Нумерованный список"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </section>
  );
};

export default Editor;
