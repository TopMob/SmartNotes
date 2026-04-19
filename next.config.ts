import type { NextConfig } from "next"

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
        source: "/:path*\\.(js|css|map|png|jpg|jpeg|gif|svg|ico|webp|avif|woff|woff2|ttf|eot)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate"
          }
        ]
      }
    ]
  }
}

export default nextConfig
