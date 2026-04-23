import { getIdentityMigrationStatus } from "@/lib/supabase/identity"
import { requireRequestAuth } from "@/lib/auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const firebaseUid = await requireRequestAuth(request)
    const status = await getIdentityMigrationStatus(firebaseUid)

    return Response.json({
      ok: true,
      ...status
    })
  } catch (error) {
    if (String(error?.message || "") === "UNAUTHORIZED") {
      return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
    }

    return Response.json(
      {
        ok: false,
        error: "IDENTITY_STATUS_FAILED",
        details: String(error?.message || error)
      },
      { status: 500 }
    )
  }
}
