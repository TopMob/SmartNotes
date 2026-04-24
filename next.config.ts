import type { NextConfig } from "next"

const publicSupabaseConfigCookie = encodeURIComponent(JSON.stringify({
  url: String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim(),
  publishableKey: String(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim(),
  googleClientId: String(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID || "").trim()
}))

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          destination: "/index.html"
        }
      ]
    }
  },
  async headers() {
    return [
      {
        source: "/",
        headers: [
          {
            key: "Set-Cookie",
            value: `smartnotes-supabase-config=${publicSupabaseConfigCookie}; Path=/; SameSite=Lax; Max-Age=300; Secure`
          }
        ]
      },
      {
        source: "/index.html",
        headers: [
          {
            key: "Set-Cookie",
            value: `smartnotes-supabase-config=${publicSupabaseConfigCookie}; Path=/; SameSite=Lax; Max-Age=300; Secure`
          }
        ]
      },
      {
        source: "/:path*\\.(js|css|map|png|jpg|jpeg|gif|svg|ico|webp|avif|woff|woff2|ttf|eot)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate"
          }
        ]
      }
    ]
  }
}

export default nextConfig
