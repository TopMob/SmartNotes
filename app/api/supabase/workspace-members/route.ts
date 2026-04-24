import {
  addWorkspaceMember,
  createAdminClient,
  handleRouteError,
  readJsonBody,
  removeWorkspaceMember,
  requireAuthenticatedUser,
  toJsonResponse,
  updateWorkspaceMember,
} from '../../../../lib/supabase/workspaces'

export const dynamic = 'force-dynamic'

type AddWorkspaceMemberRequest = {
  workspaceId: unknown
  userId: unknown
  role?: unknown
}

type UpdateWorkspaceMemberRequest = {
  workspaceId: unknown
  userId: unknown
  role: unknown
}

type RemoveWorkspaceMemberRequest = {
  workspaceId: unknown
  userId: unknown
}

export async function POST(request: Request): Promise<Response> {
  try {
    const adminClient = createAdminClient()
    const user = await requireAuthenticatedUser(request, adminClient)
    const body = await readJsonBody<AddWorkspaceMemberRequest>(request)
    const result = await addWorkspaceMember(adminClient, user.id, body)

    return toJsonResponse(result, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const adminClient = createAdminClient()
    const user = await requireAuthenticatedUser(request, adminClient)
    const body = await readJsonBody<UpdateWorkspaceMemberRequest>(request)
    const result = await updateWorkspaceMember(adminClient, user.id, body)

    return toJsonResponse(result)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const adminClient = createAdminClient()
    const user = await requireAuthenticatedUser(request, adminClient)
    const body = await readJsonBody<RemoveWorkspaceMemberRequest>(request)
    const result = await removeWorkspaceMember(adminClient, user.id, body)

    return toJsonResponse(result)
  } catch (error) {
    return handleRouteError(error)
  }
}
