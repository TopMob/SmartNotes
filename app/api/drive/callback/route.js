import { google } from "googleapis"
import { createOAuthClient } from "@/lib/drive/client"
import { getDriveCorsHeaders } from "@/lib/drive/cors"
import {
  getGoogleDriveIntegration,
  getGoogleDriveIntegrationPath,
  saveGoogleDriveIntegration
} from "@/lib/drive/integrationStore"
import { consumeOAuthState } from "@/lib/drive/oauthStateStore"
import { parseOAuthState } from "@/lib/drive/state"

export const runtime = "nodejs"

const DEFAULT_FRONTEND_URL = "https://smartnotess.vercel.app/"

function getFrontendBaseUrl() {
  const envUrl = process.env.FRONTEND_URL
  if (typeof envUrl === "string" && envUrl.trim()) {
    try {
      return new URL(envUrl).toString()
    } catch {}
  }

  return DEFAULT_FRONTEND_URL
}

function buildFrontendRedirectUrl(status, reason = "") {
  const url = new URL(getFrontendBaseUrl())
  url.searchParams.set("drive", status)

  if (reason) {
    url.searchParams.set("reason", reason)
  }

  return url.toString()
}

function redirectResponse(request, status, reason = "") {
  return new Response(null, {
    status: 302,
    headers: {
      ...getDriveCorsHeaders(request, "GET, OPTIONS"),
      Location: buildFrontendRedirectUrl(status, reason)
    }
  })
}

async function readUserEmailSafe(oauth2Client) {
  try {
    const oauth2 = google.oauth2({ auth: oauth2Client, version: "v2" })
    const userInfo = await oauth2.userinfo.get()
    return userInfo?.data?.email || ""
  } catch (error) {
    console.error("[drive-callback] userinfo.get failed", {
      message: error?.message,
      stack: error?.stack,
      responseData: error?.response?.data
    })
    return ""
  }
}

function logCallbackError(stage, error, extras = {}) {
  console.error("[drive-callback] callback failed", {
    stage,
    message: error?.message,
    stack: error?.stack,
    responseData: error?.response?.data,
    ...extras
  })
}

export async function OPTIONS(request) {
  return new Response(null, {
    status: 200,
    headers: getDriveCorsHeaders(request, "GET, OPTIONS")
  })
}

export async function GET(request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const state = requestUrl.searchParams.get("state")

  if (!code || !state) {
    console.error("[drive-callback] missing code/state", {
      hasCode: Boolean(code),
      hasState: Boolean(state)
    })
    return redirectResponse(request, "error", "missing_code_or_state")
  }

  let uid = ""

  try {
    const parsedState = parseOAuthState(state)
    uid = parsedState.uid
    const consumedState = await consumeOAuthState(state)

    if (!consumedState?.uid || consumedState.uid !== uid) {
      console.error("[drive-callback] invalid consumed state", {
        parsedUid: uid,
        consumedUid: consumedState?.uid || null
      })
      return redirectResponse(request, "error", "invalid_state")
    }
  } catch (error) {
    logCallbackError("state_validation", error)
    return redirectResponse(request, "error", "state_validation_failed")
  }

  try {
    const oauth2Client = createOAuthClient()
    const tokenResponse = await oauth2Client.getToken(code)
    const tokens = tokenResponse.tokens || {}

    console.info("[drive-callback] token exchange result", {
      uid,
      hasRefreshToken: Boolean(tokens.refresh_token),
      hasAccessToken: Boolean(tokens.access_token)
    })

    oauth2Client.setCredentials(tokens)

    const integrationPath = getGoogleDriveIntegrationPath(uid)
    const existingIntegration = await getGoogleDriveIntegration(uid)
    const fallbackRefreshToken = existingIntegration?.refreshToken || ""

    if (!tokens.refresh_token) {
      console.warn("[drive-callback] refresh token not returned by Google", {
        uid,
        integrationPath
      })
    }

    if (!tokens.refresh_token && fallbackRefreshToken) {
      console.info("[drive-callback] using existing refresh token fallback", {
        uid,
        integrationPath
      })
    }

    const refreshToken = tokens.refresh_token || fallbackRefreshToken
    if (!refreshToken) {
      console.error("[drive-callback] missing refresh token after fallback", {
        uid,
        integrationPath,
        hasExistingIntegration: Boolean(existingIntegration?.hasDoc)
      })
      return redirectResponse(request, "error", "missing_refresh_token")
    }

    const email = await readUserEmailSafe(oauth2Client)

    await saveGoogleDriveIntegration({ uid, refreshToken, email })

    console.info("[drive-callback] integration saved", {
      uid,
      integrationPath,
      hasRefreshToken: Boolean(refreshToken),
      hasEmail: Boolean(email)
    })

    return redirectResponse(request, "connected")
  } catch (error) {
    logCallbackError("token_exchange_or_save", error, { uid })
    return redirectResponse(request, "error", "token_exchange_or_save_failed")
  }
}
