import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const GOOGLE_DRIVE_INTEGRATIONS_TABLE = "google_drive_integrations"

function getIntegrationPath(uid) {
  return `${GOOGLE_DRIVE_INTEGRATIONS_TABLE}/${uid}`
}

function getIntegrationsTable() {
  return getSupabaseAdminClient().from(GOOGLE_DRIVE_INTEGRATIONS_TABLE)
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
  const { error } = await getIntegrationsTable().upsert(
    {
      uid,
      refresh_token: refreshToken,
      email: email || "",
      connected_at: new Date().toISOString()
    },
    { onConflict: "uid" }
  )

  if (error) {
    throw error
  }
}

export async function getGoogleDriveIntegration(uid) {
  const { data, error } = await getIntegrationsTable()
    .select("uid, refresh_token, email, connected_at")
    .eq("uid", uid)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return { hasDoc: false, refreshToken: "", email: "" }
  }

  const normalized = normalizeIntegration(data)
  if (!normalized) {
    return { hasDoc: true, refreshToken: "", email: "" }
  }

  return {
    hasDoc: true,
    ...normalized
  }
}

export async function deleteGoogleDriveIntegration(uid) {
  const { error } = await getIntegrationsTable().delete().eq("uid", uid)
  if (error) {
    throw error
  }
}
