/**
 * Manual live-API test for the MMS gateway.
 *
 * Run: npx tsx scripts/test-mms-live.ts
 *
 * Reads provider API keys from env (FAL_KEY, OPENAI_API_KEY,
 * GOOGLE_GEMINI_API_KEY, FREEPIK_API_KEY). Generates real images for any
 * provider whose key is set. If no keys are set, prints a message and exits.
 */

import { mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createModelGateway } from '../src/lib/core/models/gateway'
import type {
  GatewayRequest,
  GatewayResponse,
  ModelDefinition,
} from '../src/lib/core/models/types'

const OUT_DIR = '/tmp/mms-test'
const PROMPT = 'A serene mountain landscape at sunrise, digital art style'

interface ProviderProbe {
  id: string
  envVar: string
  label: string
}

const PROVIDERS: ProviderProbe[] = [
  { id: 'fal-ai', envVar: 'FAL_KEY', label: 'fal-ai' },
  { id: 'openai', envVar: 'OPENAI_API_KEY', label: 'openai' },
  { id: 'google-gemini', envVar: 'GOOGLE_GEMINI_API_KEY', label: 'google-gemini' },
  { id: 'freepik', envVar: 'FREEPIK_API_KEY', label: 'freepik' },
]

const hasKey = (envVar: string): boolean => {
  const v = process.env[envVar]
  return typeof v === 'string' && v.length > 0
}

const fmtUsd = (n: number): string => `$${n.toFixed(3)}`
const fmtMs = (n: number): string => `${Math.round(n)}ms`
const fmtBytes = (n: number | undefined): string => {
  if (!n) return 'n/a'
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`
  return `${(n / (1024 * 1024)).toFixed(2)}MB`
}

const fileSizeBytes = (path: string | undefined): number | undefined => {
  if (!path) return undefined
  try {
    return statSync(path).size
  } catch {
    return undefined
  }
}

const printProviderAvailability = (): void => {
  console.log('\nProviders available:')
  for (const p of PROVIDERS) {
    const ok = hasKey(p.envVar)
    const mark = ok ? '✓' : '✗'
    const state = ok ? `(${p.envVar} set)` : `(${p.envVar} not set)`
    console.log(`  ${mark} ${p.label} ${state}`)
  }
}

const printModel = (m: ModelDefinition): void => {
  const price = m.pricing['image-generation']?.costPerUnit ?? 0
  console.log(`  ${m.id} (${m.providerId}) — ${fmtUsd(price)}/img — ${m.qualityTier}`)
}

const printResponse = (label: string, res: GatewayResponse): void => {
  const sizePath = res.result.filePath
  const size = res.result.fileSizeBytes ?? fileSizeBytes(sizePath)
  console.log(`\n--- ${label} ---`)
  console.log(`Model: ${res.modelId} | Provider: ${res.providerId}`)
  console.log(
    `Cost: ${fmtUsd(res.cost.costUsd)} | Duration: ${fmtMs(res.cost.durationMs)}`,
  )
  if (res.success) {
    console.log(`File: ${sizePath ?? '(none)'} | Size: ${fmtBytes(size)}`)
  } else {
    console.log(`FAILED: ${res.error ?? 'unknown error'}`)
  }
}

const main = async (): Promise<void> => {
  console.log('=== MMS Live Test ===')

  printProviderAvailability()

  const anyKey = PROVIDERS.some((p) => hasKey(p.envVar))
  if (!anyKey) {
    console.log(
      '\nNo provider API keys are configured. Set at least one of ' +
        PROVIDERS.map((p) => p.envVar).join(', ') +
        ' in .env.local and re-run.',
    )
    return
  }

  mkdirSync(OUT_DIR, { recursive: true })

  const gateway = createModelGateway()

  const available = gateway.getAvailableModels('image-generation')
  console.log(`\nAvailable image-generation models: ${available.length}`)
  if (available.length === 0) {
    console.log('No image-generation models resolve with the current env keys.')
    return
  }
  for (const m of available) printModel(m)

  const byPrice = [...available].sort(
    (a, b) =>
      (a.pricing['image-generation']?.costPerUnit ?? 0) -
      (b.pricing['image-generation']?.costPerUnit ?? 0),
  )

  const cheapest = byPrice[0]
  const req: GatewayRequest = {
    capability: 'image-generation',
    params: {
      prompt: PROMPT,
      width: 1024,
      height: 1024,
      outputDir: OUT_DIR,
    },
    preferences: { modelId: cheapest.id },
    context: { callerTag: 'mms-live-test' },
  }

  const single = await gateway.request(req)
  printResponse('Single Generation (cheapest)', single)

  if (byPrice.length >= 2) {
    const ids = [byPrice[0].id, byPrice[1].id]
    console.log(`\n--- Tournament (${ids.length} models) ---`)
    const multi = await gateway.requestMultiple(
      { ...req, preferences: {} },
      ids,
    )
    for (const r of multi) {
      const size = r.result.fileSizeBytes ?? fileSizeBytes(r.result.filePath)
      const mark = r.success ? '✓' : '✗'
      console.log(
        `  ${r.modelId.padEnd(22)} | ${fmtUsd(r.cost.costUsd).padStart(7)} | ` +
          `${fmtMs(r.cost.durationMs).padStart(8)} | ${fmtBytes(size).padStart(8)} | ${mark}`,
      )
    }
  } else {
    console.log('\n(Only 1 model available — skipping tournament comparison.)')
  }

  const summary = gateway.getCostSummary()
  console.log('\n--- Cost Summary ---')
  console.log(
    `  Total: ${fmtUsd(summary.totalCostUsd)} | Calls: ${summary.callCount} | ` +
      `Avg: ${fmtUsd(summary.avgCostUsd)} | Success: ${summary.successCount}/${summary.callCount}`,
  )

  console.log('\n--- Health ---')
  const dash = gateway.getHealthDashboard()
  if (dash.size === 0) {
    console.log('  (no outcomes recorded)')
  } else {
    for (const [providerId, status] of dash) {
      console.log(
        `  ${providerId}: ${status.status} (${Math.round(status.successRate * 100)}%, ` +
          `avg ${fmtMs(status.avgLatencyMs)}, n=${status.sampleSize})`,
      )
    }
  }

  console.log(`\nImages saved to ${OUT_DIR}/`)
}

main().catch((err) => {
  console.error('MMS live test failed:', err)
  process.exit(1)
})
