import { requireUidFromRequest } from "@/lib/drive/auth"
import { getGoogleDriveIntegration } from "@/lib/drive/integrationStore"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request) {
  try {
    const uid = await requireUidFromRequest(request)
    const integration = await getGoogleDriveIntegration(uid)
    const connected = Boolean(integration?.refreshToken)

    return Response.json(
      {
        connected,
        email: connected ? integration?.email || "" : "",
        debug: {
          hasDoc: Boolean(integration?.hasDoc),
          hasRefreshToken: Boolean(integration?.refreshToken)
        }
      },
      { status: 200 }
    )
  } catch (error) {
    if (String(error?.message || "") === "UNAUTHORIZED") {
      return Response.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 })
    }

    console.error("[drive-status] failed", {
      message: error?.message,
      stack: error?.stack
    })

    return Response.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 })
  }
}
