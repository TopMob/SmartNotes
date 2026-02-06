import { onAuthStateChanged } from "firebase/auth";
import { useEffect } from "react";
import { auth } from "../lib/firebase";
import { useStore } from "../store/useStore";

export const useAuth = () => {
  const setUser = useStore((state) => state.setUser);
  const setAuthStatus = useStore((state) => state.setAuthStatus);

  useEffect(() => {
    setAuthStatus("loading");
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setAuthStatus("authenticated");
      } else {
        setUser(null);
        setAuthStatus("unauthenticated");
      }
    });

    return () => unsubscribe();
  }, [setAuthStatus, setUser]);
};
