'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Rocket } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function LaunchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: projectId } = use(params)

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href={`/project/${projectId}/configure`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to Configuration
        </Link>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/50">
              <Rocket size={28} className="text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-lg">Production Handoff</CardTitle>
            <CardDescription>
              Ready to create production jobs
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Badge variant="outline" className="text-xs">
              PC-8.4 — Coming next
            </Badge>
            <p className="mt-4 text-sm text-muted-foreground">
              This page will trigger the production handoff — creating pipeline
              jobs for each component, batching videos in groups of 10, and
              kicking off the production pipeline.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
