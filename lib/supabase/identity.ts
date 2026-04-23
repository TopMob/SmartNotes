import { getSupabaseAdminClient } from "./admin"

export async function findProfileByLegacyFirebaseUid(firebaseUid: string) {
  const normalizedUid = String(firebaseUid || "").trim()
  if (!normalizedUid) return null

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url, legacy_firebase_uid")
    .eq("legacy_firebase_uid", normalizedUid)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data || null
}

export async function getIdentityMigrationStatus(firebaseUid: string) {
  const profile = await findProfileByLegacyFirebaseUid(firebaseUid)

  return {
    firebaseUid: String(firebaseUid || "").trim(),
    mapped: Boolean(profile?.id),
    profileId: profile?.id || null,
    profile
  }
}
