import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: "Director's Room",
  description: 'Next generation AI filmmaking — tell your story.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
