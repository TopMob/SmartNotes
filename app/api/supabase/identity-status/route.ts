import { getIdentityMigrationStatus } from "@/lib/supabase/identity"
import { ApiRouteError, requireSupabaseUser } from "@/lib/supabase/api"

export const runtime = "nodejs"

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "")
}

export async function GET(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const status = await getIdentityMigrationStatus(user.id)

    return Response.json({
      ok: true,
      ...status
    })
  } catch (error) {
    if (error instanceof ApiRouteError && error.code === "UNAUTHORIZED") {
      return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
    }

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
