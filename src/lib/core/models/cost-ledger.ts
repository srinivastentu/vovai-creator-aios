import { writeFile } from 'node:fs/promises'
import type {
  Capability,
  CostRecord,
  CostSummary,
  ModelCostSummary,
} from './types'

export interface CostLedgerFilter {
  modelId?: string
  providerId?: string
  capability?: Capability
  projectId?: string
  stageId?: string
  callerTag?: string
  after?: string
  before?: string
}

export interface CostLedgerOptions {
  flushPath?: string
  flushIntervalMs?: number
  silent?: boolean
}

export interface CostLedger {
  record(entry: CostRecord): void
  getTotal(filter?: CostLedgerFilter): CostSummary
  getByModel(modelId: string): CostRecord[]
  getByProvider(providerId: string): CostRecord[]
  getByProject(projectId: string): CostRecord[]
  getSummaryTable(): ModelCostSummary[]
  exportToJsonl(filePath: string): Promise<void>
  getRecordCount(): number
  clear(): void
}

const matches = (record: CostRecord, filter: CostLedgerFilter): boolean => {
  if (filter.modelId && record.modelId !== filter.modelId) return false
  if (filter.providerId && record.providerId !== filter.providerId) return false
  if (filter.capability && record.capability !== filter.capability) return false
  if (filter.projectId && record.context.projectId !== filter.projectId) return false
  if (filter.stageId && record.context.stageId !== filter.stageId) return false
  if (filter.callerTag && record.context.callerTag !== filter.callerTag) return false
  if (filter.after && record.timestamp < filter.after) return false
  if (filter.before && record.timestamp > filter.before) return false
  return true
}

const summarize = (records: CostRecord[]): CostSummary => {
  let totalCostUsd = 0
  let successCount = 0
  let failureCount = 0
  let totalTokensIn = 0
  let totalTokensOut = 0
  let totalDurationMs = 0
  for (const r of records) {
    totalCostUsd += r.costUsd
    if (r.success) successCount += 1
    else failureCount += 1
    totalTokensIn += r.tokensIn ?? 0
    totalTokensOut += r.tokensOut ?? 0
    totalDurationMs += r.durationMs
  }
  const callCount = records.length
  const avgCostUsd = callCount === 0 ? 0 : totalCostUsd / callCount
  const successRate = callCount === 0 ? 0 : successCount / callCount
  return {
    totalCostUsd,
    callCount,
    successCount,
    failureCount,
    avgCostUsd,
    successRate,
    totalTokensIn,
    totalTokensOut,
    totalDurationMs,
  }
}

export const createCostLedger = (options: CostLedgerOptions = {}): CostLedger => {
  const records: CostRecord[] = []
  const silent = options.silent === true

  const record = (entry: CostRecord): void => {
    records.push(entry)
    if (!silent) {
      const status = entry.success ? 'ok' : 'fail'
      // eslint-disable-next-line no-console
      console.log(
        `[cost] ${entry.modelId} via ${entry.providerId} ${status} $${entry.costUsd.toFixed(4)} ${entry.durationMs}ms`,
      )
    }
  }

  const filterRecords = (filter: CostLedgerFilter): CostRecord[] =>
    records.filter((r) => matches(r, filter))

  const getTotal = (filter: CostLedgerFilter = {}): CostSummary =>
    summarize(filterRecords(filter))

  const getByModel = (modelId: string): CostRecord[] =>
    records.filter((r) => r.modelId === modelId)

  const getByProvider = (providerId: string): CostRecord[] =>
    records.filter((r) => r.providerId === providerId)

  const getByProject = (projectId: string): CostRecord[] =>
    records.filter((r) => r.context.projectId === projectId)

  const getSummaryTable = (): ModelCostSummary[] => {
    const groups = new Map<string, CostRecord[]>()
    for (const r of records) {
      const bucket = groups.get(r.modelId) ?? []
      bucket.push(r)
      groups.set(r.modelId, bucket)
    }
    const rows: ModelCostSummary[] = []
    for (const [modelId, group] of groups.entries()) {
      const totalCostUsd = group.reduce((sum, r) => sum + r.costUsd, 0)
      const totalDurationMs = group.reduce((sum, r) => sum + r.durationMs, 0)
      const successes = group.filter((r) => r.success).length
      rows.push({
        modelId,
        providerId: group[0].providerId,
        callCount: group.length,
        totalCostUsd,
        avgCostUsd: totalCostUsd / group.length,
        avgDurationMs: totalDurationMs / group.length,
        successRate: successes / group.length,
      })
    }
    rows.sort((a, b) => b.totalCostUsd - a.totalCostUsd)
    return rows
  }

  const exportToJsonl = async (filePath: string): Promise<void> => {
    const body = records.map((r) => JSON.stringify(r)).join('\n')
    await writeFile(filePath, body.length === 0 ? '' : `${body}\n`, 'utf8')
  }

  const getRecordCount = (): number => records.length

  const clear = (): void => {
    records.length = 0
  }

  return {
    record,
    getTotal,
    getByModel,
    getByProvider,
    getByProject,
    getSummaryTable,
    exportToJsonl,
    getRecordCount,
    clear,
  }
}
