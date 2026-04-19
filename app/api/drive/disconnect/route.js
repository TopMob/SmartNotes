import { requireRequestAuth } from "@/lib/auth"
import { revokeOAuthRefreshToken } from "@/lib/drive/client"
import { deleteGoogleDriveIntegration, getGoogleDriveIntegration } from "@/lib/drive/integrationStore"

export const runtime = "nodejs"

async function handleDisconnect(request) {
  try {
    const uid = await requireRequestAuth(request)
    const integration = await getGoogleDriveIntegration(uid)
    const refreshToken = String(integration?.refreshToken || "").trim()
    if (refreshToken) {
      try {
        await revokeOAuthRefreshToken(refreshToken)
      } catch (error) {
        console.warn("[drive-disconnect] revoke failed", {
          uid,
          message: error?.message
        })
      }
    }
    await deleteGoogleDriveIntegration(uid)

    return Response.json({ success: true }, { status: 200 })
  } catch (error) {
    if (String(error?.message || "") === "UNAUTHORIZED") {
      return Response.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 })
    }

    console.error("[drive-disconnect] failed", {
      message: error?.message,
      stack: error?.stack
    })

    return Response.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 })
  }
}

export async function POST(request) {
  return handleDisconnect(request)
}

export async function DELETE(request) {
  return handleDisconnect(request)
}
