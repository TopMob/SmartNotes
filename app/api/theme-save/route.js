import { readJsonObject } from "@/lib/http/jsonBody"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

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
    mainBackgroundUrl: String(settings.mainBackgroundUrl ?? ""),
    sidebarBackgroundUrl: String(settings.sidebarBackgroundUrl ?? ""),
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
    mainBackgroundUrl: String(customPreset?.mainBackgroundUrl ?? ""),
    sidebarBackgroundUrl: String(customPreset?.sidebarBackgroundUrl ?? ""),
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

    const supabase = getSupabaseAdminClient()
    const normalizedUid = uid.trim()
    const sanitizedSettings = sanitizeSettings(settings)
    const sanitizedCustomPresets = sanitizeCustomPresets(customPresets)
    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("profiles")
      .select("metadata, app_language")
      .eq("id", normalizedUid)
      .maybeSingle()

    if (existingProfileError) {
      throw existingProfileError
    }

    const currentMetadata = existingProfile?.metadata && typeof existingProfile.metadata === "object" && !Array.isArray(existingProfile.metadata)
      ? existingProfile.metadata
      : {}

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: normalizedUid,
        app_language: existingProfile?.app_language === "en" ? "en" : "ru",
        metadata: {
          ...currentMetadata,
          themeId: sanitizedSettings.preset || "oled",
          customTheme: sanitizedSettings,
          customPresets: sanitizedCustomPresets
        }
      })

    if (error) {
      throw error
    }

    return Response.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Theme save error", error)
    return Response.json({ error: "Internal error" }, { status: 500 })
  }
}
