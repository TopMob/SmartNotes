import admin from "firebase-admin"

function parseServiceAccount() {
  const rawCredentials = process.env.FIREBASE_ADMIN_JSON || process.env.FIREBASE_SERVICE_ACCOUNT
  if (!rawCredentials) {
    throw new Error("Missing firebase service credentials")
  }

  return JSON.parse(rawCredentials)
}

function getFirebaseApp() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(parseServiceAccount())
    })
  }

  return admin.app()
}

export function getFirebaseAuth() {
  return getFirebaseApp().auth()
}

export function getFirestoreDatabase() {
  return getFirebaseApp().firestore()
}
