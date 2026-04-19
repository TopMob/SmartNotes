import admin from "firebase-admin"
import { getFirestoreDatabase } from "../firebaseAdmin"

function getIntegrationPath(uid) {
  return `users/${uid}/integrations/googleDrive`
}

function getIntegrationRef(uid) {
  return getFirestoreDatabase().doc(getIntegrationPath(uid))
}

function normalizeIntegration(data) {
  if (!data || typeof data !== "object") {
    return null
  }

  const refreshToken = data.refreshToken || data.refresh_token || ""

  return {
    ...data,
    refreshToken,
    email: typeof data.email === "string" ? data.email : ""
  }
}

export function getGoogleDriveIntegrationPath(uid) {
  return getIntegrationPath(uid)
}

export async function saveGoogleDriveIntegration({ uid, refreshToken, email }) {
  await getIntegrationRef(uid).set(
    {
      refreshToken,
      email: email || "",
      connectedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  )
}

export async function getGoogleDriveIntegration(uid) {
  const snapshot = await getIntegrationRef(uid).get()
  if (!snapshot.exists) {
    return { hasDoc: false, refreshToken: "", email: "" }
  }

  const normalized = normalizeIntegration(snapshot.data() || {})
  if (!normalized) {
    return { hasDoc: true, refreshToken: "", email: "" }
  }

  return {
    hasDoc: true,
    ...normalized
  }
}

export async function deleteGoogleDriveIntegration(uid) {
  await getIntegrationRef(uid).delete()
}
