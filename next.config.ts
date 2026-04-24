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
            value: "public, max-age=0, must-revalidate"
          }
        ]
      }
    ]
  }
}

export default nextConfig
