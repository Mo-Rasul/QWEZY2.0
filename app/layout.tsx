import './globals.css'
export const metadata = { title: 'Qwezy — Query Easily', description: 'Natural language data queries powered by AI.' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
