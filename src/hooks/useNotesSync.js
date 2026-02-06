import { collection, onSnapshot, query } from "firebase/firestore";
import { useEffect } from "react";
import { db } from "../lib/firebase";
import { useStore } from "../store/useStore";

export const useNotesSync = () => {
  const userId = useStore((state) => state.user?.uid);
  const setNotes = useStore((state) => state.setNotes);

  useEffect(() => {
    if (!userId) {
      setNotes([]);
      return undefined;
    }

    const notesQuery = query(collection(db, "users", userId, "notes"));
    const unsubscribe = onSnapshot(notesQuery, (snapshot) => {
      const notes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotes(notes);
    });

    return () => unsubscribe();
  }, [setNotes, userId]);
};
