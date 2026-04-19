import { requireRequestAuth } from "@/lib/auth"
import { getDriveCorsHeaders, jsonResponse } from "@/lib/drive/cors"
import { deleteGoogleDriveIntegration } from "@/lib/drive/integrationStore"

export const runtime = "nodejs"

async function handleDisconnect(request) {
  try {
    const uid = await requireRequestAuth(request)
    await deleteGoogleDriveIntegration(uid)

    return jsonResponse(request, { success: true }, 200, "POST, DELETE, OPTIONS")
  } catch (error) {
    if (String(error?.message || "") === "UNAUTHORIZED") {
      return jsonResponse(request, { success: false, error: "UNAUTHORIZED" }, 401, "POST, DELETE, OPTIONS")
    }

    console.error("[drive-disconnect] failed", {
      message: error?.message,
      stack: error?.stack
    })

    return jsonResponse(request, { success: false, error: "INTERNAL_ERROR" }, 500, "POST, DELETE, OPTIONS")
  }
}

export async function OPTIONS(request) {
  return new Response(null, {
    status: 200,
    headers: getDriveCorsHeaders(request, "POST, DELETE, OPTIONS")
  })
}

export async function POST(request) {
  return handleDisconnect(request)
}

export async function DELETE(request) {
  return handleDisconnect(request)
}
