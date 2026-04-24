import {
  createAdminClient,
  createWorkspace,
  getWorkspaceForUser,
  handleRouteError,
  listUserWorkspaces,
  readJsonBody,
  requireAuthenticatedUser,
  toJsonResponse,
  updateWorkspace,
} from '../../../../lib/supabase/workspaces'

export const dynamic = 'force-dynamic'

type CreateWorkspaceRequest = {
  name: unknown
  description?: unknown
}

type UpdateWorkspaceRequest = {
  workspaceId: unknown
  name?: unknown
  description?: unknown
}

export async function POST(request: Request): Promise<Response> {
  try {
    const adminClient = createAdminClient()
    const user = await requireAuthenticatedUser(request, adminClient)
    const body = await readJsonBody<CreateWorkspaceRequest>(request)
    const result = await createWorkspace(adminClient, user.id, body)

    return toJsonResponse(result, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const adminClient = createAdminClient()
    const user = await requireAuthenticatedUser(request, adminClient)
    const url = new URL(request.url)
    const workspaceId = (url.searchParams.get('workspaceId') ?? '').trim()
    const result = workspaceId
      ? await getWorkspaceForUser(adminClient, workspaceId, user.id)
      : await listUserWorkspaces(adminClient, user.id)

    return toJsonResponse(result)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const adminClient = createAdminClient()
    const user = await requireAuthenticatedUser(request, adminClient)
    const body = await readJsonBody<UpdateWorkspaceRequest>(request)
    const result = await updateWorkspace(adminClient, user.id, body)

    return toJsonResponse(result)
  } catch (error) {
    return handleRouteError(error)
  }
}
