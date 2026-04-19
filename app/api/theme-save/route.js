import admin from "firebase-admin"
import { getFirestoreDatabase } from "@/lib/firebaseAdmin"
import { readJsonObject } from "@/lib/http/jsonBody"

export const runtime = "nodejs"

function toNumber(value, fallbackValue) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallbackValue
}

function toOpacity(value, fallbackValue) {
  const numericValue = toNumber(value, fallbackValue)
  if (numericValue < 0) {
    return 0
  }

  if (numericValue > 1) {
    return 1
  }

  return numericValue
}

function sanitizeSettings(settings) {
  return {
    preset: String(settings.preset ?? "oled"),
    p: String(settings.p ?? ""),
    bg: String(settings.bg ?? ""),
    t: String(settings.t ?? ""),
    mainBackgroundImage: String(settings.mainBackgroundImage ?? ""),
    sidebarBackgroundImage: String(settings.sidebarBackgroundImage ?? ""),
    uiOpacity: toOpacity(settings.uiOpacity, 0.78),
    cardsOpacity: toOpacity(settings.cardsOpacity, 0.9)
  }
}

function sanitizeCustomPresets(customPresets) {
  if (!Array.isArray(customPresets)) {
    return []
  }

  return customPresets.slice(0, 5).map(customPreset => ({
    key: String(customPreset?.key ?? ""),
    p: String(customPreset?.p ?? ""),
    bg: String(customPreset?.bg ?? ""),
    t: String(customPreset?.t ?? ""),
    mainBackgroundImage: String(customPreset?.mainBackgroundImage ?? ""),
    sidebarBackgroundImage: String(customPreset?.sidebarBackgroundImage ?? "")
  }))
}

export async function POST(request) {
  try {
    const payload = await readJsonObject(request)
    const uid = payload.uid
    const settings = payload.settings
    const customPresets = payload.customPresets

    if (typeof uid !== "string" || !uid.trim()) {
      return Response.json({ error: "Invalid uid" }, { status: 400 })
    }

    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      return Response.json({ error: "Invalid settings" }, { status: 400 })
    }

    const database = getFirestoreDatabase()

    await database.doc(`users/${uid}/preferences/theme`).set(
      {
        settings: sanitizeSettings(settings),
        customPresets: sanitizeCustomPresets(customPresets),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    )

    return Response.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Theme save error", error)
    return Response.json({ error: "Internal error" }, { status: 500 })
  }
}
