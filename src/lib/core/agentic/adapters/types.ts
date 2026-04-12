// Producer adapter types — domain-agnostic.
// An adapter turns a goal + system prompt into a typed artifact,
// and revises prior artifacts using a GradeReport (PRESERVE/IMPROVE).

import type { GradeReport } from '../../engine/types'

export interface Artifact<T = unknown> {
  id: string
  version: number
  kind: string
  content: T
  createdAt: Date
  modelUsed: string
  tokensIn: number
  tokensOut: number
  costUSD: number
}

export interface ProduceArgs {
  goal: string
  systemPrompt: string
  maxTokens?: number
}

export interface ReviseArgs<T = unknown> extends ProduceArgs {
  previous: Artifact<T>
  grade: GradeReport
  humanFeedback?: string
}

export interface ProducerAdapter<T = unknown> {
  produce(args: ProduceArgs): Promise<Artifact<T>>
  revise(args: ReviseArgs<T>): Promise<Artifact<T>>
}
