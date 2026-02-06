import { useMemo } from "react";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import dayjs from "dayjs";
import { Trash2 } from "lucide-react";
import { useNotesStore } from "../store/useNotesStore";

function SortableCard({ note, isActive, onSelect, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      onClick={() => onSelect(note.id)}
      className={`group w-full rounded-xl border p-3 text-left transition ${
        isActive
          ? "border-sky-400/60 bg-sky-500/10"
          : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
      } ${isDragging ? "opacity-60" : ""}`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">
            {note.title}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Обновлено {dayjs(note.updatedAt).fromNow()}
          </div>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(note.id);
          }}
          className="opacity-0 transition group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4 text-slate-400 hover:text-rose-400" />
        </button>
      </div>
    </button>
  );
}

export default function NotesList({ filteredNotes }) {
  const notes = useNotesStore((state) => state.notes);
  const activeId = useNotesStore((state) => state.activeId);
  const setActiveId = useNotesStore((state) => state.setActiveId);
  const reorderNotes = useNotesStore((state) => state.reorderNotes);
  const deleteNote = useNotesStore((state) => state.deleteNote);

  const sensors = useSensors(useSensor(PointerSensor));

  const ids = useMemo(() => filteredNotes.map((note) => note.id), [filteredNotes]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeIndex = notes.findIndex((note) => note.id === active.id);
    const overIndex = notes.findIndex((note) => note.id === over.id);
    reorderNotes(arrayMove(notes, activeIndex, overIndex));
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {filteredNotes.map((note) => (
            <SortableCard
              key={note.id}
              note={note}
              isActive={note.id === activeId}
              onSelect={setActiveId}
              onDelete={deleteNote}
            />
          ))}
          {filteredNotes.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-400">
              Ничего не найдено.
            </div>
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}
