#!/usr/bin/env tsx
// Compare a run-text-loop output dir to a fact sheet and emit a calibration report.
// Usage: npx tsx scripts/diff-against-facts.ts <runDir> <factSheet.json>
//
// Extracts each fact's value via a loose case-insensitive substring (or
// numeric-range) match from the best artifact, then reports how the judge
// scored accuracy for that run.

import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

interface Fact {
  claim: string
  value: string
  tolerance: 'exact' | 'range'
}
interface FactSheet {
  topic: string
  facts: Fact[]
}

function loadSheet(path: string): FactSheet {
  return JSON.parse(readFileSync(path, 'utf8')) as FactSheet
}

function bestArtifact(runDir: string): { path: string; content: string } {
  const grades = JSON.parse(readFileSync(join(runDir, 'grades.json'), 'utf8')) as {
    bestVersion?: number | null
  }
  const files = readdirSync(runDir).filter((f) => /^v\d+\.md$/.test(f))
  let chosen = files.sort().pop() ?? ''
  if (grades.bestVersion) {
    const candidate = `v${grades.bestVersion}.md`
    if (files.includes(candidate)) chosen = candidate
  }
  const p = join(runDir, chosen)
  return { path: p, content: readFileSync(p, 'utf8') }
}

function factPresent(article: string, fact: Fact): boolean {
  const hay = article.toLowerCase()
  const raw = fact.value.toLowerCase()
  if (fact.tolerance === 'exact') {
    // Try literal, and for single-number values also try the unformatted number.
    if (hay.includes(raw)) return true
    const numMatch = raw.match(/(\d[\d.,]*)/)
    return !!numMatch && hay.includes(numMatch[1])
  }
  // Range: split on - and check either endpoint exists.
  const cleaned = raw.replace(/[~%$,]/g, '').replace(/\s+/g, '')
  const parts = cleaned.split(/[-–]/).filter(Boolean)
  return parts.some((p) => hay.includes(p))
}

async function main() {
  const [runDir, sheetPath] = process.argv.slice(2)
  if (!runDir || !sheetPath) {
    console.error('Usage: npx tsx scripts/diff-against-facts.ts <runDir> <factSheet.json>')
    process.exit(1)
  }
  const runDirAbs = resolve(runDir)
  const sheet = loadSheet(resolve(sheetPath))
  const art = bestArtifact(runDirAbs)
  const grades = JSON.parse(readFileSync(join(runDirAbs, 'grades.json'), 'utf8')) as {
    iterations: { version: number; dimensions: Record<string, number> }[]
    bestVersion?: number | null
  }
  const best = grades.iterations.find((i) => i.version === grades.bestVersion) ??
    grades.iterations[grades.iterations.length - 1]

  const rows = sheet.facts.map((f) => ({
    claim: f.claim,
    expected: f.value,
    present: factPresent(art.content, f),
  }))
  const matched = rows.filter((r) => r.present).length

  console.log(`\n=== Fact-sheet diff — ${sheet.topic} ===`)
  console.log(`Artifact: ${art.path}`)
  console.log(`Matched ${matched}/${rows.length} canonical facts`)
  console.log(`Judge accuracy score: ${best?.dimensions?.accuracy ?? 'n/a'}`)
  console.log('')
  for (const r of rows) {
    console.log(`  [${r.present ? 'x' : ' '}] ${r.claim} — expected: ${r.expected}`)
  }
  console.log('')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
