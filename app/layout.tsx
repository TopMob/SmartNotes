import type { Metadata } from "next"
import { headers } from "next/headers"

export const metadata: Metadata = {
  title: "SmartNotes",
  description: "SmartNotes - Ваши умные заметки с синхронизацией и ИИ"
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") || undefined

  return (
    <html lang="ru">
      <body nonce={nonce}>{children}</body>
    </html>
  )
}
