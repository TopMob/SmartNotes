import crypto from "crypto"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const STATE_TTL_MS = 10 * 60 * 1000
const OAUTH_STATES_TABLE = "drive_oauth_states"

function getStateDocId(state) {
  return crypto.createHash("sha256").update(String(state)).digest("hex")
}

function getOAuthStatesTable() {
  return getSupabaseAdminClient().from(OAUTH_STATES_TABLE)
}

export async function saveOAuthState({ state, uid }) {
  const expiresAt = new Date(Date.now() + STATE_TTL_MS).toISOString()
  const { error } = await getOAuthStatesTable().upsert(
    {
      state_hash: getStateDocId(state),
      uid,
      state,
      expires_at: expiresAt,
      created_at: new Date().toISOString()
    },
    { onConflict: "state_hash" }
  )

  if (error) {
    throw error
  }
}

export async function consumeOAuthState(state) {
  const { data, error } = await getOAuthStatesTable()
    .delete()
    .eq("state_hash", getStateDocId(state))
    .select("uid, state, expires_at")
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  if (data.state !== state || !data.uid) {
    return null
  }

  if (Date.parse(String(data.expires_at || "")) < Date.now()) {
    return null
  }

  return { uid: data.uid }
}
