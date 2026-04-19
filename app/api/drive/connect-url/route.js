import { requireUidFromRequest } from "@/lib/drive/auth"
import { createGoogleDriveConnectUrl } from "@/lib/drive/connectUrl"

export const runtime = "nodejs"

export async function POST(request) {
  try {
    const uid = await requireUidFromRequest(request)
    const { url } = await createGoogleDriveConnectUrl(uid)

    return Response.json({ url }, { status: 200 })
  } catch (error) {
    if (String(error?.message || "") === "UNAUTHORIZED") {
      return Response.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 })
    }

    return Response.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 })
  }
}
