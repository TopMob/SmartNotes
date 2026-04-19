import { createOAuthClient } from "@/lib/drive/client"
import { createOAuthState } from "@/lib/drive/state"
import { saveOAuthState } from "@/lib/drive/oauthStateStore"

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"

export async function createGoogleDriveConnectUrl(uid) {
  const state = createOAuthState(uid)
  await saveOAuthState({ state, uid })

  const oauth2Client = createOAuthClient()
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent select_account",
    scope: [DRIVE_SCOPE],
    state
  })

  return { url, state }
}
