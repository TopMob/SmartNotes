import { getSupabaseAdminClient } from "./admin"

type ApiErrorCode = "BAD_REQUEST" | "UNAUTHORIZED" | "INTERNAL_ERROR"

export class ApiRouteError extends Error {
  status: number
  code: ApiErrorCode | string

  constructor(status: number, code: ApiErrorCode | string, message?: string) {
    super(message || code)
    this.status = status
    this.code = code
  }
}

type AuthenticatedSupabaseUser = {
  id: string
  email: string
  displayName: string
  avatarUrl: string
}

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || ""
  if (!authorization.startsWith("Bearer ")) {
    return ""
  }

  return authorization.slice(7).trim()
}

export async function requireSupabaseUser(request: Request): Promise<AuthenticatedSupabaseUser> {
  const token = readBearerToken(request)
  if (!token) {
    throw new ApiRouteError(401, "UNAUTHORIZED")
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user?.id) {
    throw new ApiRouteError(401, "UNAUTHORIZED")
  }

  return {
    id: data.user.id,
    email: data.user.email || "",
    displayName: String(data.user.user_metadata?.display_name || ""),
    avatarUrl: String(data.user.user_metadata?.avatar_url || "")
  }
}

export async function readJsonBody(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new ApiRouteError(400, "BAD_REQUEST")
  }
}

export function ok(data: Record<string, unknown>, init?: ResponseInit) {
  return Response.json({ ok: true, ...data }, init)
}

export function fail(status: number, code: string) {
  return Response.json({ ok: false, error: code }, { status })
}

export function handleRouteError(error: unknown, fallbackCode: string) {
  if (error instanceof ApiRouteError) {
    return fail(error.status, error.code)
  }

  return fail(500, fallbackCode)
}
export function mapApiRouteError(error: unknown, badRequestMessages: string[]) {
  const message = String(error instanceof Error ? error.message : error || "")
  if (badRequestMessages.includes(message)) {
    return new ApiRouteError(400, message)
  }
  return error
}
