import { getSupabaseUserSettings, saveSupabaseUserSettings } from "@/lib/supabase/notes"
import { handleRouteError, ok, readJsonBody, requireSupabaseUser } from "@/lib/supabase/api"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const settings = await getSupabaseUserSettings(user.id)
    return ok({ settings })
  } catch (error) {
    return handleRouteError(error, "SETTINGS_FAILED")
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const payload = await readJsonBody(request)
    const settings = await saveSupabaseUserSettings(user.id, payload?.settings || payload || {})
    return ok({ settings })
  } catch (error) {
    return handleRouteError(error, "SETTINGS_SAVE_FAILED")
  }
}
