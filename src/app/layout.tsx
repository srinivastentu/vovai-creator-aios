import type { Metadata } from 'next'
import './globals.css'
import { Inter, JetBrains_Mono } from "next/font/google"
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'VOVAI CreatorOS',
  description: 'Agentic AI content production OS for creators.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable, jetbrainsMono.variable)}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
