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

export async function getIdentityMigrationStatus(profileId: string) {
  const normalizedProfileId = String(profileId || "").trim()
  if (!normalizedProfileId) {
    return {
      firebaseUid: "",
      mapped: false,
      profileId: null,
      profile: null
    }
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url, legacy_firebase_uid")
    .eq("id", normalizedProfileId)
    .maybeSingle()

  if (error) {
    throw error
  }

  const profile = data || null
  const firebaseUid = typeof profile?.legacy_firebase_uid === "string"
    ? profile.legacy_firebase_uid.trim()
    : ""

  return {
    firebaseUid,
    mapped: Boolean(firebaseUid),
    profileId: profile?.id || null,
    profile
  }
}
