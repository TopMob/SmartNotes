"use client"

import { useEffect, useState } from "react"

import { getSupabaseBrowserClient } from "@/lib/supabase/client"

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
    <main style={styles.page}>
      <section style={styles.card} aria-live="polite">
        <div style={styles.badge}>{status === "error" ? "Ошибка" : "OAuth"}</div>
        <h1 style={styles.title}>{title}</h1>
        <p style={styles.text}>{description}</p>
        {status !== "error" ? <div style={styles.loader} aria-hidden="true" /> : null}
      </section>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "24px",
    background: "radial-gradient(circle at top, #1f2937 0%, #0f1115 52%, #090b0f 100%)",
    color: "#f5f7fb",
    fontFamily: "Inter, Arial, sans-serif"
  },
  card: {
    width: "100%",
    maxWidth: "460px",
    padding: "32px 28px",
    borderRadius: "20px",
    background: "rgba(15, 17, 21, 0.88)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.35)",
    textAlign: "center"
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "72px",
    height: "32px",
    marginBottom: "18px",
    padding: "0 12px",
    borderRadius: "999px",
    background: "rgba(96, 165, 250, 0.14)",
    color: "#93c5fd",
    fontSize: "13px",
    fontWeight: 600,
    letterSpacing: "0.02em"
  },
  title: {
    margin: 0,
    fontSize: "28px",
    lineHeight: 1.15
  },
  text: {
    margin: "14px 0 0",
    fontSize: "15px",
    lineHeight: 1.6,
    color: "rgba(245, 247, 251, 0.8)"
  },
  loader: {
    width: "42px",
    height: "42px",
    margin: "22px auto 0",
    borderRadius: "999px",
    border: "3px solid rgba(255, 255, 255, 0.14)",
    borderTopColor: "#60a5fa",
    animation: "spin 0.8s linear infinite"
  }
}
