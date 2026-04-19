import crypto from "crypto"
import admin from "firebase-admin"
import { getFirestoreDatabase } from "@/lib/firebaseAdmin"

const STATE_TTL_MS = 10 * 60 * 1000

function getStateDocId(state) {
  return crypto.createHash("sha256").update(String(state)).digest("hex")
}

function getStateRef(state) {
  return getFirestoreDatabase().doc(`driveOAuthStates/${getStateDocId(state)}`)
}

export async function saveOAuthState({ state, uid }) {
  await getStateRef(state).set({
    uid,
    state,
    expiresAt: Date.now() + STATE_TTL_MS,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  })
}

export async function consumeOAuthState(state) {
  const ref = getStateRef(state)
  const snapshot = await ref.get()

  if (!snapshot.exists) {
    return null
  }

  const data = snapshot.data() || {}
  await ref.delete()

  if (data.state !== state || !data.uid) {
    return null
  }

  if (Number(data.expiresAt || 0) < Date.now()) {
    return null
  }

  return { uid: data.uid }
}
