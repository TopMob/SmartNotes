import { getIdentityMigrationStatus } from "@/lib/supabase/identity"
import { requireRequestAuth } from "@/lib/auth"

export const runtime = "nodejs"

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "")
}

export async function GET(request: Request) {
  try {
    const firebaseUid = await requireRequestAuth(request)
    const status = await getIdentityMigrationStatus(firebaseUid)

    return Response.json({
      ok: true,
      ...status
    })
  } catch (error) {
    if (getErrorMessage(error) === "UNAUTHORIZED") {
      return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
    }

    return Response.json(
      {
        ok: false,
        error: "IDENTITY_STATUS_FAILED",
        details: getErrorMessage(error)
      },
      { status: 500 }
    )
  }
}
