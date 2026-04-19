import { google } from "googleapis"

function getGoogleEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("GOOGLE_ENV_MISSING")
  }

  return { clientId, clientSecret, redirectUri }
}

export function createOAuthClient() {
  const { clientId, clientSecret, redirectUri } = getGoogleEnv()
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export function createDriveClientWithRefreshToken(refreshToken) {
  const oauth2Client = createOAuthClient()
  oauth2Client.setCredentials({ refresh_token: refreshToken })

  return {
    oauth2Client,
    drive: google.drive({ version: "v3", auth: oauth2Client })
  }
}

export async function revokeOAuthRefreshToken(refreshToken) {
  const token = String(refreshToken || "").trim()
  if (!token) return false
  const oauth2Client = createOAuthClient()
  await oauth2Client.revokeToken(token)
  return true
}
