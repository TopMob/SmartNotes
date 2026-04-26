import type { Metadata } from "next"
import { headers } from "next/headers"
import Script from "next/script"

const bootstrapScript = `
window.APP_VERSION = "2026-02-22-1e1b181"
window.SmartNotesSupabaseConfig = (() => {
    const cookiePrefix = "smartnotes-supabase-config="
    const encodedCookie = document.cookie
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(cookiePrefix))

    if (!encodedCookie) {
        return null
    }

    try {
        const cookieValue = encodedCookie.slice(cookiePrefix.length)
        const parsedValue = JSON.parse(decodeURIComponent(cookieValue))

        if (!parsedValue || typeof parsedValue.url !== 'string' || typeof parsedValue.publishableKey !== 'string') {
            return null
        }

        return {
            ...parsedValue,
            googleClientId: typeof parsedValue.googleClientId === 'string' ? parsedValue.googleClientId : ''
        }
    } catch {
        return null
    }
})()

window.__smartnotesSupabaseConfigPromise = fetch('/api/supabase/config', {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-store' }
})
    .then((response) => response.ok ? response.json() : null)
    .then((payload) => {
        if (!payload || payload.ok !== true) return window.SmartNotesSupabaseConfig
        const nextConfig = {
            url: typeof payload.url === 'string' ? payload.url : '',
            publishableKey: typeof payload.publishableKey === 'string' ? payload.publishableKey : '',
            googleClientId: typeof payload.googleClientId === 'string' ? payload.googleClientId : ''
        }
        if (nextConfig.url && nextConfig.publishableKey) {
            window.SmartNotesSupabaseConfig = nextConfig
        }
        return window.SmartNotesSupabaseConfig
    })
    .catch(() => window.SmartNotesSupabaseConfig)

window.SmartNotesAuthUi = {
    ready: false,
    markReady() {
        this.ready = true
    }
}

document.addEventListener('submit', (event) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement)) return
    if (form.id !== 'email-signin-form' && form.id !== 'email-signup-form') return
    event.preventDefault()
}, true)
`

export const metadata: Metadata = {
  title: "SmartNotes",
  description: "SmartNotes - Ваши умные заметки с синхронизацией и ИИ"
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") || undefined

  return (
    <html lang="ru">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#0f1115" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="SmartNotes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico?v=2026-02-22-1e1b181" />
        <link rel="apple-touch-icon" href="/Logo.png?v=2026-02-22-1e1b181" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="stylesheet" href="/css/base.css?v=2026-04-19-final" />
        <link rel="stylesheet" href="/css/layout.css?v=2026-04-19-final" />
        <link rel="stylesheet" href="/css/components.css?v=2026-04-19-final" />
        <link rel="stylesheet" href="/css/responsive.css?v=2026-04-19-final" />
        <link rel="preload" href="/css/editor.css?v=2026-04-19-final" as="style" fetchPriority="low" data-deferred-stylesheet="" />
        <noscript>
          <link rel="stylesheet" href="/css/editor.css?v=2026-04-19-final" />
        </noscript>
      </head>
      <body nonce={nonce}>
        {children}
        <Script id="smartnotes-bootstrap" nonce={nonce} strategy="beforeInteractive">
          {bootstrapScript}
        </Script>
        <Script src="/js/load-foundation.js?v=2026-04-19-final" nonce={nonce} strategy="beforeInteractive" />
        <Script src="/js/core/backendConfig.js?v=2026-04-19-final" nonce={nonce} type="module" strategy="afterInteractive" />
        <Script src="/js/core/infra-engine.js?v=2026-04-19-final" nonce={nonce} type="module" strategy="afterInteractive" />
        <Script src="/js/load-engines.js?v=2026-04-19-final" nonce={nonce} strategy="afterInteractive" />
        <Script src="/js/lang.js?v=2026-04-19-final" nonce={nonce} type="module" strategy="afterInteractive" />
        <Script src="/js/theme.js?v=2026-04-19-final" nonce={nonce} type="module" strategy="afterInteractive" />
        <Script src="/js/core.js?v=2026-04-19-final" nonce={nonce} type="module" strategy="afterInteractive" />
        <Script src="/js/load-services.js?v=2026-04-19-final" nonce={nonce} strategy="afterInteractive" />
        <Script src="/js/load-ui-core.js?v=2026-04-19-final" nonce={nonce} strategy="afterInteractive" />
        <Script src="/js/load-ui-render.js?v=2026-04-19-final" nonce={nonce} strategy="afterInteractive" />
        <Script src="/js/load-notes-stack.js?v=2026-04-19-final" nonce={nonce} strategy="afterInteractive" />
        <Script src="/js/editor/core.js?v=2026-04-19-final" nonce={nonce} type="module" strategy="afterInteractive" fetchPriority="low" />
        <Script src="/js/load-app.js?v=2026-04-19-final" nonce={nonce} strategy="lazyOnload" />
      </body>
    </html>
  )
}
