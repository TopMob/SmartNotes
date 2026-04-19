import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Smart Notes Backend",
  description: "API and service endpoints for Smart Notes"
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
