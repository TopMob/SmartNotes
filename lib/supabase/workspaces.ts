import { createHash, randomBytes } from 'crypto'

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type WorkspaceRole = 'owner' | 'admin' | 'member'

export type WorkspaceRecord = {
  id: string
  name: string
  description: string | null
  owner_user_id: string
  created_at?: string
  updated_at?: string
}

export type WorkspaceMemberRecord = {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  created_at?: string
  updated_at?: string
}

export type WorkspaceInviteRecord = {
  id: string
  workspace_id: string
  email: string | null
  role: WorkspaceRole
  token_hash: string
  created_by_user_id: string
  accepted_by_user_id: string | null
  accepted_at: string | null
  revoked_at: string | null
  expires_at: string
  created_at?: string
}

export type WorkspaceClientShape = {
  id: string
  name: string
  description: string | null
  ownerUid: string
  role: WorkspaceRole
  members: Record<string, WorkspaceRole>
  memberNames: Record<string, string>
  createdAt: string | null
  updatedAt: string | null
}

export class ApiError extends Error {
  status: number
  details?: Json

  constructor(status: number, message: string, details?: Json) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const WORKSPACES_TABLE = 'workspaces'
const MEMBERS_TABLE = 'workspace_members'
const INVITES_TABLE = 'workspace_invites'

const ROLE_RANK: Record<WorkspaceRole, number> = {
  member: 1,
  admin: 2,
  owner: 3,
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new ApiError(500, `${name} is not configured`)
  }

  return value
}

export function createAdminClient(): SupabaseClient {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

export function getBearerToken(request: Request): string {
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing bearer token')
  }

  const token = authorization.slice('Bearer '.length).trim()
  if (!token) {
    throw new ApiError(401, 'Missing bearer token')
  }

  return token
}

export async function requireAuthenticatedUser(request: Request, adminClient = createAdminClient()): Promise<User> {
  const token = getBearerToken(request)
  const { data, error } = await adminClient.auth.getUser(token)

  if (error || !data.user) {
    throw new ApiError(401, 'Invalid or expired Supabase token')
  }

  return data.user
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }
}

export function normalizeOptionalString(value: unknown): string | null {
  if (value == null) {
    return null
  }

  if (typeof value !== 'string') {
    throw new ApiError(400, 'Expected a string value')
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new ApiError(400, `${fieldName} is required`)
  }

  const normalized = value.trim()
  if (!normalized) {
    throw new ApiError(400, `${fieldName} is required`)
  }

  return normalized
}

export function parseWorkspaceRole(value: unknown, fallback: WorkspaceRole = 'member'): WorkspaceRole {
  if (value == null) {
    return fallback
  }

  if (value === 'owner' || value === 'admin' || value === 'member') {
    return value
  }

  throw new ApiError(400, 'role must be one of: owner, admin, member')
}

export function assertCanManageMembers(role: WorkspaceRole): void {
  if (ROLE_RANK[role] < ROLE_RANK.admin) {
    throw new ApiError(403, 'Workspace admin access required')
  }
}

export function assertCanAssignRole(actorRole: WorkspaceRole, targetRole: WorkspaceRole): void {
  if (ROLE_RANK[actorRole] <= ROLE_RANK[targetRole]) {
    throw new ApiError(403, 'Cannot assign an equal or higher workspace role')
  }
}

export function assertCanChangeMember(actorRole: WorkspaceRole, targetRole: WorkspaceRole): void {
  if (ROLE_RANK[actorRole] <= ROLE_RANK[targetRole]) {
    throw new ApiError(403, 'Cannot modify an equal or higher workspace role')
  }
}

export async function requireWorkspaceAccess(
  adminClient: SupabaseClient,
  workspaceId: string,
  userId: string,
): Promise<WorkspaceMemberRecord> {
  const { data, error } = await adminClient
    .from(MEMBERS_TABLE)
    .select('id, workspace_id, user_id, role, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle<WorkspaceMemberRecord>()

  if (error) {
    throw new ApiError(500, 'Failed to load workspace membership', error.message)
  }

  if (!data) {
    throw new ApiError(403, 'Not a member of this workspace')
  }

  return data
}

export async function requireWorkspaceExists(adminClient: SupabaseClient, workspaceId: string): Promise<WorkspaceRecord> {
  const { data, error } = await adminClient
    .from(WORKSPACES_TABLE)
    .select('id, name, description, owner_user_id, created_at, updated_at')
    .eq('id', workspaceId)
    .maybeSingle<WorkspaceRecord>()

  if (error) {
    throw new ApiError(500, 'Failed to load workspace', error.message)
  }

  if (!data) {
    throw new ApiError(404, 'Workspace not found')
  }

  return data
}

function resolveUserDisplayName(user: User | null | undefined, fallbackUserId: string): string {
  const metadata = user?.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {}
  const appMetadata = user?.app_metadata && typeof user.app_metadata === 'object' ? user.app_metadata : {}
  const candidates = [
    typeof metadata.displayName === 'string' ? metadata.displayName : null,
    typeof metadata.display_name === 'string' ? metadata.display_name : null,
    typeof metadata.name === 'string' ? metadata.name : null,
    typeof appMetadata.displayName === 'string' ? appMetadata.displayName : null,
    typeof appMetadata.display_name === 'string' ? appMetadata.display_name : null,
    typeof user?.email === 'string' ? user.email.split('@')[0] : null,
    fallbackUserId,
  ]

  for (const candidate of candidates) {
    const normalized = typeof candidate === 'string' ? candidate.trim() : ''
    if (normalized) return normalized
  }

  return fallbackUserId
}

async function loadUserDisplayNames(adminClient: SupabaseClient, userIds: string[]): Promise<Map<string, string>> {
  const displayNames = new Map<string, string>()
  const uniqueUserIds = Array.from(new Set(userIds.map(userId => userId.trim()).filter(Boolean)))

  await Promise.all(
    uniqueUserIds.map(async userId => {
      try {
        const { data, error } = await adminClient.auth.admin.getUserById(userId)
        if (error) {
          displayNames.set(userId, userId)
          return
        }
        displayNames.set(userId, resolveUserDisplayName(data.user, userId))
      } catch {
        displayNames.set(userId, userId)
      }
    }),
  )

  return displayNames
}

function buildWorkspaceClientShape(
  workspace: WorkspaceRecord,
  actorMembership: WorkspaceMemberRecord,
  members: WorkspaceMemberRecord[],
  displayNames: Map<string, string>,
): WorkspaceClientShape {
  const membersRecord: Record<string, WorkspaceRole> = {}
  const memberNames: Record<string, string> = {}

  members.forEach(member => {
    if (!member.user_id) return
    membersRecord[member.user_id] = member.role
    memberNames[member.user_id] = displayNames.get(member.user_id) ?? member.user_id
  })

  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description ?? null,
    ownerUid: workspace.owner_user_id,
    role: actorMembership.role,
    members: membersRecord,
    memberNames,
    createdAt: workspace.created_at ?? null,
    updatedAt: workspace.updated_at ?? null,
  }
}

export async function listUserWorkspaces(
  adminClient: SupabaseClient,
  userId: string,
): Promise<{ workspaces: WorkspaceClientShape[] }> {
  const { data: memberships, error: membershipsError } = await adminClient
    .from(MEMBERS_TABLE)
    .select('id, workspace_id, user_id, role, created_at, updated_at')
    .eq('user_id', userId)
    .returns<WorkspaceMemberRecord[]>()

  if (membershipsError) {
    throw new ApiError(500, 'Failed to load user workspaces', membershipsError.message)
  }

  if (!memberships?.length) {
    return { workspaces: [] }
  }

  const workspaceIds = Array.from(new Set(memberships.map(membership => membership.workspace_id).filter(Boolean)))

  const [{ data: workspaces, error: workspacesError }, { data: allMembers, error: membersError }] = await Promise.all([
    adminClient
      .from(WORKSPACES_TABLE)
      .select('id, name, description, owner_user_id, created_at, updated_at')
      .in('id', workspaceIds)
      .returns<WorkspaceRecord[]>(),
    adminClient
      .from(MEMBERS_TABLE)
      .select('id, workspace_id, user_id, role, created_at, updated_at')
      .in('workspace_id', workspaceIds)
      .returns<WorkspaceMemberRecord[]>(),
  ])

  if (workspacesError) {
    throw new ApiError(500, 'Failed to load workspaces', workspacesError.message)
  }

  if (membersError) {
    throw new ApiError(500, 'Failed to load workspace members', membersError.message)
  }

  const safeWorkspaces = workspaces ?? []
  const safeMembers = allMembers ?? []
  const membershipByWorkspaceId = new Map(memberships.map(membership => [membership.workspace_id, membership]))
  const membersByWorkspaceId = new Map<string, WorkspaceMemberRecord[]>()

  safeMembers.forEach(member => {
    const existing = membersByWorkspaceId.get(member.workspace_id) ?? []
    existing.push(member)
    membersByWorkspaceId.set(member.workspace_id, existing)
  })

  const displayNames = await loadUserDisplayNames(adminClient, safeMembers.map(member => member.user_id))

  return {
    workspaces: safeWorkspaces
      .map(workspace => {
        const actorMembership = membershipByWorkspaceId.get(workspace.id)
        if (!actorMembership) return null
        return buildWorkspaceClientShape(
          workspace,
          actorMembership,
          membersByWorkspaceId.get(workspace.id) ?? [],
          displayNames,
        )
      })
      .filter((workspace): workspace is WorkspaceClientShape => workspace !== null),
  }
}

export async function getWorkspaceForUser(
  adminClient: SupabaseClient,
  workspaceId: string,
  userId: string,
): Promise<{ workspace: WorkspaceClientShape }> {
  const actorMembership = await requireWorkspaceAccess(adminClient, workspaceId, userId)
  const [workspace, membersResult] = await Promise.all([
    requireWorkspaceExists(adminClient, workspaceId),
    adminClient
      .from(MEMBERS_TABLE)
      .select('id, workspace_id, user_id, role, created_at, updated_at')
      .eq('workspace_id', workspaceId)
      .returns<WorkspaceMemberRecord[]>(),
  ])

  if (membersResult.error) {
    throw new ApiError(500, 'Failed to load workspace members', membersResult.error.message)
  }

  const members = membersResult.data ?? []
  const displayNames = await loadUserDisplayNames(adminClient, members.map(member => member.user_id))

  return {
    workspace: buildWorkspaceClientShape(workspace, actorMembership, members, displayNames),
  }
}

export async function createWorkspace(
  adminClient: SupabaseClient,
  userId: string,
  input: { name: unknown; description?: unknown },
): Promise<{ workspace: WorkspaceRecord; membership: WorkspaceMemberRecord }> {
  const name = requireString(input.name, 'name')
  const description = normalizeOptionalString(input.description)

  const { data: workspace, error: workspaceError } = await adminClient
    .from(WORKSPACES_TABLE)
    .insert({
      name,
      description,
      owner_user_id: userId,
    })
    .select('id, name, description, owner_user_id, created_at, updated_at')
    .single<WorkspaceRecord>()

  if (workspaceError || !workspace) {
    throw new ApiError(500, 'Failed to create workspace', workspaceError?.message)
  }

  const { data: membership, error: membershipError } = await adminClient
    .from(MEMBERS_TABLE)
    .upsert(
      {
        workspace_id: workspace.id,
        user_id: userId,
        role: 'owner',
      },
      { onConflict: 'workspace_id,user_id' },
    )
    .select('id, workspace_id, user_id, role, created_at, updated_at')
    .single<WorkspaceMemberRecord>()

  if (membershipError || !membership) {
    throw new ApiError(500, 'Workspace created but owner membership failed', membershipError?.message)
  }

  return { workspace, membership }
}

export async function updateWorkspace(
  adminClient: SupabaseClient,
  actorUserId: string,
  input: { workspaceId: unknown; name?: unknown; description?: unknown },
): Promise<{ workspace: WorkspaceRecord; actorMembership: WorkspaceMemberRecord }> {
  const workspaceId = requireString(input.workspaceId, 'workspaceId')
  const actorMembership = await requireWorkspaceAccess(adminClient, workspaceId, actorUserId)

  assertCanManageMembers(actorMembership.role)

  const patch: { name?: string; description?: string | null } = {}

  if (input.name !== undefined) {
    patch.name = requireString(input.name, 'name')
  }

  if (input.description !== undefined) {
    patch.description = normalizeOptionalString(input.description)
  }

  if (Object.keys(patch).length === 0) {
    throw new ApiError(400, 'No workspace fields to update')
  }

  const { data: workspace, error } = await adminClient
    .from(WORKSPACES_TABLE)
    .update(patch)
    .eq('id', workspaceId)
    .select('id, name, description, owner_user_id, created_at, updated_at')
    .single<WorkspaceRecord>()

  if (error || !workspace) {
    throw new ApiError(500, 'Failed to update workspace', error?.message)
  }

  return { workspace, actorMembership }
}

export async function addWorkspaceMember(
  adminClient: SupabaseClient,
  actorUserId: string,
  input: { workspaceId: unknown; userId: unknown; role?: unknown },
): Promise<{ membership: WorkspaceMemberRecord; actorMembership: WorkspaceMemberRecord }> {
  const workspaceId = requireString(input.workspaceId, 'workspaceId')
  const userId = requireString(input.userId, 'userId')
  const role = parseWorkspaceRole(input.role, 'member')

  const actorMembership = await requireWorkspaceAccess(adminClient, workspaceId, actorUserId)
  assertCanManageMembers(actorMembership.role)
  assertCanAssignRole(actorMembership.role, role)

  await requireWorkspaceExists(adminClient, workspaceId)

  const { data: membership, error } = await adminClient
    .from(MEMBERS_TABLE)
    .upsert(
      {
        workspace_id: workspaceId,
        user_id: userId,
        role,
      },
      { onConflict: 'workspace_id,user_id' },
    )
    .select('id, workspace_id, user_id, role, created_at, updated_at')
    .single<WorkspaceMemberRecord>()

  if (error || !membership) {
    throw new ApiError(500, 'Failed to add workspace member', error?.message)
  }

  return { membership, actorMembership }
}

export async function updateWorkspaceMember(
  adminClient: SupabaseClient,
  actorUserId: string,
  input: { workspaceId: unknown; userId: unknown; role: unknown },
): Promise<{ membership: WorkspaceMemberRecord; actorMembership: WorkspaceMemberRecord }> {
  const workspaceId = requireString(input.workspaceId, 'workspaceId')
  const userId = requireString(input.userId, 'userId')
  const role = parseWorkspaceRole(input.role)

  const actorMembership = await requireWorkspaceAccess(adminClient, workspaceId, actorUserId)
  assertCanManageMembers(actorMembership.role)
  assertCanAssignRole(actorMembership.role, role)

  const { data: targetMembership, error: targetError } = await adminClient
    .from(MEMBERS_TABLE)
    .select('id, workspace_id, user_id, role, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle<WorkspaceMemberRecord>()

  if (targetError) {
    throw new ApiError(500, 'Failed to load workspace member', targetError.message)
  }

  if (!targetMembership) {
    throw new ApiError(404, 'Workspace member not found')
  }

  assertCanChangeMember(actorMembership.role, targetMembership.role)

  const { data: membership, error } = await adminClient
    .from(MEMBERS_TABLE)
    .update({ role })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .select('id, workspace_id, user_id, role, created_at, updated_at')
    .single<WorkspaceMemberRecord>()

  if (error || !membership) {
    throw new ApiError(500, 'Failed to update workspace member', error?.message)
  }

  return { membership, actorMembership }
}

export async function removeWorkspaceMember(
  adminClient: SupabaseClient,
  actorUserId: string,
  input: { workspaceId: unknown; userId: unknown },
): Promise<{ removed: true; actorMembership: WorkspaceMemberRecord }> {
  const workspaceId = requireString(input.workspaceId, 'workspaceId')
  const userId = requireString(input.userId, 'userId')

  const actorMembership = await requireWorkspaceAccess(adminClient, workspaceId, actorUserId)
  assertCanManageMembers(actorMembership.role)

  const { data: targetMembership, error: targetError } = await adminClient
    .from(MEMBERS_TABLE)
    .select('id, workspace_id, user_id, role, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle<WorkspaceMemberRecord>()

  if (targetError) {
    throw new ApiError(500, 'Failed to load workspace member', targetError.message)
  }

  if (!targetMembership) {
    throw new ApiError(404, 'Workspace member not found')
  }

  assertCanChangeMember(actorMembership.role, targetMembership.role)

  const { error } = await adminClient
    .from(MEMBERS_TABLE)
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)

  if (error) {
    throw new ApiError(500, 'Failed to remove workspace member', error.message)
  }

  return { removed: true, actorMembership }
}

export function createInviteToken(): string {
  return randomBytes(24).toString('base64url')
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createWorkspaceInvite(
  adminClient: SupabaseClient,
  actorUserId: string,
  input: { workspaceId: unknown; email?: unknown; role?: unknown; expiresInDays?: unknown },
): Promise<{ invite: Omit<WorkspaceInviteRecord, 'token_hash'>; token: string; actorMembership: WorkspaceMemberRecord }> {
  const workspaceId = requireString(input.workspaceId, 'workspaceId')
  const role = parseWorkspaceRole(input.role, 'member')
  const email = normalizeOptionalString(input.email)?.toLowerCase() ?? null
  const expiresInDays =
    typeof input.expiresInDays === 'number' && Number.isFinite(input.expiresInDays) ? Math.floor(input.expiresInDays) : 7

  if (expiresInDays < 1 || expiresInDays > 30) {
    throw new ApiError(400, 'expiresInDays must be between 1 and 30')
  }

  const actorMembership = await requireWorkspaceAccess(adminClient, workspaceId, actorUserId)
  assertCanManageMembers(actorMembership.role)
  assertCanAssignRole(actorMembership.role, role)

  const token = createInviteToken()
  const tokenHash = hashInviteToken(token)
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()

  const { data: invite, error } = await adminClient
    .from(INVITES_TABLE)
    .insert({
      workspace_id: workspaceId,
      email,
      role,
      token_hash: tokenHash,
      created_by_user_id: actorUserId,
      expires_at: expiresAt,
    })
    .select('id, workspace_id, email, role, created_by_user_id, accepted_by_user_id, accepted_at, revoked_at, expires_at, created_at')
    .single<Omit<WorkspaceInviteRecord, 'token_hash'>>()

  if (error || !invite) {
    throw new ApiError(500, 'Failed to create workspace invite', error?.message)
  }

  return { invite, token, actorMembership }
}

export async function acceptWorkspaceInvite(
  adminClient: SupabaseClient,
  user: User,
  input: { token: unknown },
): Promise<{ membership: WorkspaceMemberRecord; invite: Omit<WorkspaceInviteRecord, 'token_hash'> }> {
  const token = requireString(input.token, 'token')
  const tokenHash = hashInviteToken(token)

  const { data: invite, error: inviteError } = await adminClient
    .from(INVITES_TABLE)
    .select('id, workspace_id, email, role, token_hash, created_by_user_id, accepted_by_user_id, accepted_at, revoked_at, expires_at, created_at')
    .eq('token_hash', tokenHash)
    .maybeSingle<WorkspaceInviteRecord>()

  if (inviteError) {
    throw new ApiError(500, 'Failed to load workspace invite', inviteError.message)
  }

  if (!invite) {
    throw new ApiError(404, 'Invite not found')
  }

  if (invite.revoked_at) {
    throw new ApiError(410, 'Invite has been revoked')
  }

  if (invite.accepted_at) {
    throw new ApiError(409, 'Invite has already been accepted')
  }

  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    throw new ApiError(410, 'Invite has expired')
  }

  if (invite.email && user.email?.toLowerCase() !== invite.email.toLowerCase()) {
    throw new ApiError(403, 'Invite email does not match the authenticated user')
  }

  const { data: membership, error: membershipError } = await adminClient
    .from(MEMBERS_TABLE)
    .upsert(
      {
        workspace_id: invite.workspace_id,
        user_id: user.id,
        role: invite.role,
      },
      { onConflict: 'workspace_id,user_id' },
    )
    .select('id, workspace_id, user_id, role, created_at, updated_at')
    .single<WorkspaceMemberRecord>()

  if (membershipError || !membership) {
    throw new ApiError(500, 'Failed to accept workspace invite', membershipError?.message)
  }

  const { data: updatedInvite, error: updateInviteError } = await adminClient
    .from(INVITES_TABLE)
    .update({
      accepted_by_user_id: user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invite.id)
    .is('accepted_at', null)
    .select('id, workspace_id, email, role, created_by_user_id, accepted_by_user_id, accepted_at, revoked_at, expires_at, created_at')
    .single<Omit<WorkspaceInviteRecord, 'token_hash'>>()

  if (updateInviteError || !updatedInvite) {
    throw new ApiError(500, 'Invite membership created but invite finalization failed', updateInviteError?.message)
  }

  return { membership, invite: updatedInvite }
}

export function toJsonResponse(body: Json, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {}),
    },
  })
}

export function handleRouteError(error: unknown): Response {
  if (error instanceof ApiError) {
    return toJsonResponse(
      {
        error: error.message,
        details: error.details ?? null,
      },
      { status: error.status },
    )
  }

  return toJsonResponse({ error: 'Internal server error' }, { status: 500 })
}

/*
Required DB objects for this backend:

1. public.workspaces
   - id uuid primary key default gen_random_uuid()
   - name text not null
   - description text null
   - owner_user_id uuid not null references auth.users(id)
   - created_at timestamptz not null default now()
   - updated_at timestamptz not null default now()

2. public.workspace_members
   - id uuid primary key default gen_random_uuid()
   - workspace_id uuid not null references public.workspaces(id) on delete cascade
   - user_id uuid not null references auth.users(id) on delete cascade
   - role text not null check (role in ('owner', 'admin', 'member'))
   - created_at timestamptz not null default now()
   - updated_at timestamptz not null default now()
   - unique(workspace_id, user_id)

3. public.workspace_invites
   - id uuid primary key default gen_random_uuid()
   - workspace_id uuid not null references public.workspaces(id) on delete cascade
   - email text null
   - role text not null check (role in ('owner', 'admin', 'member'))
   - token_hash text not null unique
   - created_by_user_id uuid not null references auth.users(id)
   - accepted_by_user_id uuid null references auth.users(id)
   - accepted_at timestamptz null
   - revoked_at timestamptz null
   - expires_at timestamptz not null
   - created_at timestamptz not null default now()

Recommended indexes:
   - workspaces(owner_user_id)
   - workspace_members(workspace_id)
   - workspace_members(user_id)
   - workspace_invites(workspace_id)
   - workspace_invites(token_hash)

Security guidance:
   - Enable RLS on all three tables.
   - Keep the service role key server-only.
   - Prefer RLS policies that restrict rows by auth.uid(), even though these routes also enforce access in code.
*/
