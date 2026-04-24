import {
  acceptWorkspaceInvite,
  createAdminClient,
  createWorkspaceInvite,
  handleRouteError,
  readJsonBody,
  requireAuthenticatedUser,
  toJsonResponse,
} from '../../../../lib/supabase/workspaces'

export const dynamic = 'force-dynamic'

type CreateWorkspaceInviteRequest = {
  workspaceId: unknown
  email?: unknown
  role?: unknown
  expiresInDays?: unknown
}

type AcceptWorkspaceInviteRequest = {
  token: unknown
}

export async function POST(request: Request): Promise<Response> {
  try {
    const adminClient = createAdminClient()
    const user = await requireAuthenticatedUser(request, adminClient)
    const body = await readJsonBody<CreateWorkspaceInviteRequest>(request)
    const result = await createWorkspaceInvite(adminClient, user.id, body)

    return toJsonResponse(result, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const adminClient = createAdminClient()
    const user = await requireAuthenticatedUser(request, adminClient)
    const body = await readJsonBody<AcceptWorkspaceInviteRequest>(request)
    const result = await acceptWorkspaceInvite(adminClient, user, body)

    return toJsonResponse(result)
  } catch (error) {
    return handleRouteError(error)
  }
}
