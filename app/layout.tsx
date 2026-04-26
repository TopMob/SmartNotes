import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "SmartNotes",
  description: "SmartNotes - Ваши умные заметки с синхронизацией и ИИ"
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
