import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import admin from 'firebase-admin'
import { createClient } from '@supabase/supabase-js'

const repoRoot = process.cwd()
const backupDir = path.join(repoRoot, 'migration-backups')
const dryRun = process.argv.includes('--dry-run')
const RETRYABLE_ERROR_CODES = new Set(['ecconnreset', 'etimedout', 'econnrefused'])
const NOTE_UPSERT_BATCH_SIZE = 20

function readRepeatedArg(flagName) {
  return process.argv
    .filter(argument => argument.startsWith(`${flagName}=`))
    .map(argument => argument.slice(flagName.length + 1).trim())
    .filter(Boolean)
}

const skippedEmails = new Set(readRepeatedArg('--skip-email').map(value => value.toLowerCase()))
const skippedFirebaseUids = new Set(readRepeatedArg('--skip-uid'))

async function loadEnvFile(fileName) {
  const filePath = path.join(repoRoot, fileName)

  try {
    const raw = await readFile(filePath, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex <= 0) continue

      const key = trimmed.slice(0, separatorIndex).trim()
      const value = trimmed.slice(separatorIndex + 1)
      if (!key || process.env[key] !== undefined) continue
      process.env[key] = value
    }
  } catch {}
}

await loadEnvFile('.env.local')
await loadEnvFile('.env')

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing env: ${name}`)
  }
  return value
}

function parseFirebaseServiceAccount() {
  const raw = process.env.FIREBASE_ADMIN_JSON || process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) {
    throw new Error('Missing firebase service credentials')
  }
  return JSON.parse(raw)
}

function getFirebaseApp() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(parseFirebaseServiceAccount())
    })
  }

  return admin.app()
}

function getFirebaseDb() {
  return getFirebaseApp().firestore()
}

function getSupabaseAdmin() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })
}

function normalizeTimestamp(value) {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') return new Date(value).toISOString()
  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

function stripHtml(content) {
  return String(content || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeProfile(firebaseUid, data) {
  const email = typeof data?.email === 'string' ? data.email : null
  const displayName = typeof data?.displayName === 'string' ? data.displayName : ''
  const avatarUrl = typeof data?.avatarUrl === 'string' ? data.avatarUrl : ''

  return {
    firebaseUid,
    email,
    displayName,
    avatarUrl,
    raw: data || {}
  }
}

function normalizeNote(firebaseUid, noteId, data) {
  const title = String(data?.title || '').trim().slice(0, 200)
  const contentRaw = String(data?.content || '')
  const contentPlain = stripHtml(contentRaw).slice(0, 50000)

  return {
    legacyFirebaseUid: firebaseUid,
    legacyFirebaseNoteId: noteId,
    title,
    contentRaw,
    contentPlain,
    contentFormat: 'html',
    sourceType: typeof data?.sourceType === 'string' && data.sourceType.trim() ? data.sourceType.trim().slice(0, 40) : 'note',
    language: typeof data?.language === 'string' && data.language.trim() ? data.language.trim().slice(0, 16) : 'unknown',
    charCount: contentPlain.length,
    createdAt: normalizeTimestamp(data?.createdAt),
    updatedAt: normalizeTimestamp(data?.updatedAt),
    raw: data || {}
  }
}

async function ensureBackupDir() {
  await mkdir(backupDir, { recursive: true })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRetryableError(error) {
  const message = String(error?.message || '').toLowerCase()
  const details = String(error?.details || '').toLowerCase()
  const code = String(error?.code || '').toLowerCase()

  return RETRYABLE_ERROR_CODES.has(code)
    || message.includes('fetch failed')
    || message.includes('econnreset')
    || details.includes('econnreset')
    || message.includes('etimedout')
    || details.includes('etimedout')
}

async function withRetry(label, operation, { retries = 5, baseDelayMs = 500 } = {}) {
  let attempt = 0

  while (attempt <= retries) {
    try {
      return await operation()
    } catch (error) {
      if (attempt >= retries || !isRetryableError(error)) {
        throw error
      }

      const delayMs = baseDelayMs * Math.pow(2, attempt)
      console.warn(`${label} failed, retrying`, {
        attempt: attempt + 1,
        delayMs,
        message: error?.message,
        code: error?.code,
        details: error?.details
      })
      await sleep(delayMs)
      attempt += 1
    }
  }
}

async function runSupabaseOperation(label, operation, options) {
  return withRetry(label, async () => {
    const result = await operation()
    if (result?.error) {
      throw result.error
    }
    return result
  }, options)
}

async function writeBackupFile(fileName, value) {
  await ensureBackupDir()
  const filePath = path.join(backupDir, fileName)
  await writeFile(filePath, JSON.stringify(value, null, 2), 'utf8')
  return filePath
}

async function fetchFirebaseUsersAndNotes() {
  const db = getFirebaseDb()
  const usersSnapshot = await db.collection('users').get()
  const users = []

  for (const userDoc of usersSnapshot.docs) {
    const firebaseUid = userDoc.id
    const profile = normalizeProfile(firebaseUid, userDoc.data())
    const notesSnapshot = await db.collection('users').doc(firebaseUid).collection('notes').get()
    const notes = notesSnapshot.docs.map(noteDoc => normalizeNote(firebaseUid, noteDoc.id, noteDoc.data()))
    users.push({ profile, notes })
  }

  return users
}

function shouldSkipUser(profile) {
  const email = String(profile?.email || '').toLowerCase()
  const firebaseUid = String(profile?.firebaseUid || '')

  return skippedEmails.has(email) || skippedFirebaseUids.has(firebaseUid)
}

async function loadExistingProfiles(supabase) {
  const { data } = await runSupabaseOperation(
    'load existing profiles',
    () => supabase
      .from('profiles')
      .select('id, email, legacy_firebase_uid')
      .limit(5000)
  )

  const byFirebaseUid = new Map()
  const byEmail = new Map()

  for (const profile of data || []) {
    if (profile.legacy_firebase_uid) {
      byFirebaseUid.set(String(profile.legacy_firebase_uid), profile)
    }
    if (profile.email) {
      byEmail.set(String(profile.email).toLowerCase(), profile)
    }
  }

  return { byFirebaseUid, byEmail }
}

async function loadExistingAuthUsers(supabase) {
  const byEmail = new Map()
  let page = 1

  while (true) {
    const { data } = await runSupabaseOperation(
      `list auth users page ${page}`,
      () => supabase.auth.admin.listUsers({ page, perPage: 200 })
    )

    const users = data?.users || []
    for (const user of users) {
      if (user.email) {
        byEmail.set(String(user.email).toLowerCase(), user)
      }
    }

    if (users.length < 200) break
    page += 1
  }

  return byEmail
}

async function ensureSupabaseUser(supabase, profile, caches) {
  const existingProfile = caches.profilesByFirebaseUid.get(profile.firebaseUid)
  if (existingProfile?.id) return existingProfile.id

  const email = profile.email || `${profile.firebaseUid}@firebase-migrated.local`
  const normalizedEmail = email.toLowerCase()
  const existingAuthUser = caches.authUsersByEmail.get(normalizedEmail)

  if (existingAuthUser?.id) {
    await upsertProfile(supabase, existingAuthUser.id, profile)
    const cachedProfile = { id: existingAuthUser.id, email, legacy_firebase_uid: profile.firebaseUid }
    caches.profilesByFirebaseUid.set(profile.firebaseUid, cachedProfile)
    caches.profilesByEmail.set(normalizedEmail, cachedProfile)
    return existingAuthUser.id
  }

  let createdUser = null
  let createUserError = null
  try {
    const result = await runSupabaseOperation(
      `create auth user ${email}`,
      () => supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          display_name: profile.displayName,
          avatar_url: profile.avatarUrl,
          legacy_firebase_uid: profile.firebaseUid
        }
      })
    )
    createdUser = result.data
  } catch (error) {
    createUserError = error
  }

  if (createUserError) {
    const normalizedErrorCode = String(createUserError.code || '').toLowerCase()
    const normalizedErrorMessage = String(createUserError.message || '').toLowerCase()
    const isExistingUserError = normalizedErrorCode === 'email_exists'
      || normalizedErrorMessage.includes('already registered')

    if (!isExistingUserError) {
      throw createUserError
    }

    const matchedUser = caches.authUsersByEmail.get(normalizedEmail)
    if (!matchedUser?.id) {
      throw createUserError
    }

    await upsertProfile(supabase, matchedUser.id, profile)
    const cachedProfile = { id: matchedUser.id, email, legacy_firebase_uid: profile.firebaseUid }
    caches.profilesByFirebaseUid.set(profile.firebaseUid, cachedProfile)
    caches.profilesByEmail.set(normalizedEmail, cachedProfile)
    return matchedUser.id
  }

  const userId = createdUser.user?.id
  if (!userId) {
    throw new Error(`Failed to create Supabase auth user for Firebase uid ${profile.firebaseUid}`)
  }

  await upsertProfile(supabase, userId, profile)
  caches.authUsersByEmail.set(normalizedEmail, createdUser.user)
  const cachedProfile = { id: userId, email, legacy_firebase_uid: profile.firebaseUid }
  caches.profilesByFirebaseUid.set(profile.firebaseUid, cachedProfile)
  caches.profilesByEmail.set(normalizedEmail, cachedProfile)
  return userId
}

async function upsertProfile(supabase, userId, profile) {
  await runSupabaseOperation(
    `upsert profile ${profile.firebaseUid}`,
    () => supabase.from('profiles').upsert({
      id: userId,
      email: profile.email,
      display_name: profile.displayName,
      avatar_url: profile.avatarUrl,
      legacy_firebase_uid: profile.firebaseUid,
      metadata: {
        migration_source: 'firebase',
        migrated_at: new Date().toISOString()
      }
    })
  )
}

async function loadExistingNotesForUser(supabase, userId) {
  const { data } = await runSupabaseOperation(
    `load existing notes for user ${userId}`,
    () => supabase
      .from('notes')
      .select('id, legacy_firebase_note_id')
      .eq('user_id', userId)
      .limit(10000)
  )

  const byLegacyNoteId = new Map()
  for (const note of data || []) {
    if (note.legacy_firebase_note_id) {
      byLegacyNoteId.set(String(note.legacy_firebase_note_id), note)
    }
  }

  return byLegacyNoteId
}

function chunkArray(items, size) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

async function upsertNotes(supabase, userId, notes) {
  const existingNotesByLegacyId = await loadExistingNotesForUser(supabase, userId)
  const migratedAt = new Date().toISOString()
  const payloads = notes.map(note => {
    const existingNote = existingNotesByLegacyId.get(note.legacyFirebaseNoteId)
    const payload = {
      user_id: userId,
      title: note.title,
      content_raw: note.contentRaw,
      content_plain: note.contentPlain,
      content_format: note.contentFormat,
      source_type: note.sourceType,
      language: note.language,
      char_count: note.charCount,
      legacy_firebase_note_id: note.legacyFirebaseNoteId,
      metadata: {
        migration_source: 'firebase',
        legacy_firebase_uid: note.legacyFirebaseUid,
        migrated_at: migratedAt
      }
    }

    if (existingNote?.id) payload.id = existingNote.id
    if (note.createdAt) payload.created_at = note.createdAt
    if (note.updatedAt) payload.updated_at = note.updatedAt

    return payload
  })

  const noteChunks = chunkArray(payloads, NOTE_UPSERT_BATCH_SIZE)
  for (let index = 0; index < noteChunks.length; index += 1) {
    const chunk = noteChunks[index]
    console.log('Upserting note chunk', {
      userId,
      chunk: index + 1,
      totalChunks: noteChunks.length,
      size: chunk.length
    })
    try {
      await runSupabaseOperation(
        `bulk upsert notes chunk ${index + 1}/${noteChunks.length} for user ${userId}`,
        () => supabase.from('notes').upsert(chunk),
        { retries: 6, baseDelayMs: 700 }
      )
    } catch (error) {
      console.warn('Bulk upsert failed, switching to per-note fallback', {
        userId,
        chunk: index + 1,
        totalChunks: noteChunks.length,
        size: chunk.length,
        message: error?.message,
        code: error?.code,
        details: error?.details
      })

      for (const notePayload of chunk) {
        console.log('Upserting note fallback', {
          userId,
          legacyFirebaseNoteId: notePayload.legacy_firebase_note_id,
          title: String(notePayload.title || '').slice(0, 80),
          charCount: notePayload.char_count
        })

        await runSupabaseOperation(
          `fallback upsert note ${notePayload.legacy_firebase_note_id}`,
          () => supabase.from('notes').upsert(notePayload),
          { retries: 6, baseDelayMs: 900 }
        )

        await sleep(120)
      }
    }

    await sleep(100)
  }
}

async function main() {
  const allUsers = await fetchFirebaseUsersAndNotes()
  const users = allUsers.filter(userEntry => !shouldSkipUser(userEntry.profile))
  const skippedUsers = allUsers.filter(userEntry => shouldSkipUser(userEntry.profile))

  const backupPath = await writeBackupFile(`firebase-export-${Date.now()}.json`, allUsers)
  console.log(`Backup written: ${backupPath}`)

  const summary = {
    users: users.length,
    notes: users.reduce((sum, user) => sum + user.notes.length, 0),
    skippedUsers: skippedUsers.length,
    dryRun
  }

  if (skippedUsers.length) {
    console.log('Skipped users:', skippedUsers.map(userEntry => ({
      firebaseUid: userEntry.profile.firebaseUid,
      email: userEntry.profile.email,
      notes: userEntry.notes.length
    })))
  }

  if (dryRun) {
    console.log('Dry run summary:', summary)
    return
  }

  const supabase = getSupabaseAdmin()
  const caches = {
    profilesByFirebaseUid: new Map(),
    profilesByEmail: new Map(),
    authUsersByEmail: await loadExistingAuthUsers(supabase)
  }

  const existingProfiles = await loadExistingProfiles(supabase)
  caches.profilesByFirebaseUid = existingProfiles.byFirebaseUid
  caches.profilesByEmail = existingProfiles.byEmail

  for (const userEntry of users) {
    console.log('Migrating user', {
      firebaseUid: userEntry.profile.firebaseUid,
      email: userEntry.profile.email,
      notes: userEntry.notes.length
    })

    const userId = await ensureSupabaseUser(supabase, userEntry.profile, caches)
    await upsertNotes(supabase, userId, userEntry.notes)
  }

  console.log('Migration completed:', summary)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
