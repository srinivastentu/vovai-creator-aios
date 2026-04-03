'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface Crumb {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  crumbs: Crumb[]
}

export function Breadcrumbs({ crumbs }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={crumb.label} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="text-muted-foreground/40" />}
            {crumb.href && !isLast ? (
              <Link href={crumb.href} className="hover:text-foreground transition-colors">
                {crumb.label}
              </Link>
            ) : (
              <span className={isLast ? 'font-medium text-foreground' : ''}>
                {crumb.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
