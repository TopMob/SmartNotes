"use client"

import { useEffect, useState } from "react"

import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import "../../../public/css/base.css"
import "../../../public/css/components.css"

const PROFILE_SYNC_ENDPOINT = "/api/supabase/session"
const SESSION_WAIT_TIMEOUT_MS = 12000
const SESSION_WAIT_INTERVAL_MS = 150

type CallbackState = "processing" | "error"

function buildRedirectUrl(url: URL) {
  const next = String(url.searchParams.get("next") || "/").trim()
  if (!next.startsWith("/")) return "/"
  if (next.startsWith("//")) return "/"
  return next || "/"
}

function clearCallbackUrl(url: URL, nextPath: string) {
  const nextUrl = new URL(nextPath, url.origin)
  window.history.replaceState({}, document.title, nextUrl.toString())
}

function syncProfile(accessToken: string) {
  return fetch(PROFILE_SYNC_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    keepalive: true
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`profile-sync-http-${response.status}`)
      }
    })
}

async function waitForOAuthSession() {
  const supabase = getSupabaseBrowserClient()

  const initialSession = (await supabase.auth.getSession()).data.session
  if (initialSession?.access_token) {
    return initialSession
  }

  return new Promise<NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>>((resolve, reject) => {
    let settled = false
    let pollTimerId: number | null = null
    let timeoutId: number | null = null

    const cleanup = () => {
      subscription.data.subscription.unsubscribe()
      if (pollTimerId !== null) window.clearTimeout(pollTimerId)
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }

    const settleWith = (session: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(session)
    }

    const subscription = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        settleWith(session)
      }
    })

    const poll = async () => {
      if (settled) return
      const sessionResult = await supabase.auth.getSession()
      const session = sessionResult.data.session
      if (session?.access_token) {
        settleWith(session)
        return
      }
      pollTimerId = window.setTimeout(poll, SESSION_WAIT_INTERVAL_MS)
    }

    pollTimerId = window.setTimeout(poll, SESSION_WAIT_INTERVAL_MS)

    timeoutId = window.setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error("oauth-session-timeout"))
    }, SESSION_WAIT_TIMEOUT_MS)
  })
}

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<CallbackState>("processing")

  useEffect(() => {
    let cancelled = false

    const finalizeSignIn = async () => {
      const currentUrl = new URL(window.location.href)
      const nextPath = buildRedirectUrl(currentUrl)
      const session = await waitForOAuthSession()

      syncProfile(session.access_token).catch((error) => {
        console.warn("[AuthCallback] Profile sync skipped", error)
      })
      clearCallbackUrl(currentUrl, nextPath)
      window.location.replace(nextPath)
    }

    finalizeSignIn().catch((error) => {
      console.error("[AuthCallback] OAuth completion failed", error)
      if (cancelled) return
      setStatus("error")
    })

    return () => {
      cancelled = true
    }
  }, [])

  const title = status === "error" ? "Не удалось завершить вход" : "Вход в SmartNotes"
  const description = status === "error" ? "Попробуйте снова со страницы входа." : "Завершаем вход..."

  return (
    <main className="auth-callback-page">
      <section className="auth-callback-card" aria-live="polite">
        <div className="auth-callback-badge">{status === "error" ? "Ошибка" : "OAuth"}</div>
        <h1 className="auth-callback-title">{title}</h1>
        <p className="auth-callback-text">{description}</p>
        {status !== "error" ? <div className="auth-callback-loader" aria-hidden="true" /> : null}
      </section>
    </main>
  )
}
