import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  calculateCost,
  MODEL_PRICING,
  DEFAULT_PRICING,
} from '../../src/lib/domain/workflows/agents/framework/types'
import type {
  IdeationAgentConfig,
  AgentResult,
} from '../../src/lib/domain/workflows/agents/framework/types'
import {
  registerAgent,
  getAgent,
  listAgents,
  clearAgents,
} from '../../src/lib/domain/workflows/agents/framework/registry'

// ─── Test Helpers ──────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<IdeationAgentConfig> = {}): IdeationAgentConfig {
  return {
    id: 'test-agent',
    name: 'Test Agent',
    tier: 'production',
    model: {
      primary: 'claude-sonnet-4-20250514',
      fallback: 'claude-haiku-4-5-20251001',
    },
    maxRetries: 2,
    timeoutMs: 30000,
    ...overrides,
  }
}

// Mock Anthropic SDK at module level
const mockCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate }
    },
  }
})

// ─── Types Tests ───────────────────────────────────────────────────────────

describe('Agent Framework Types', () => {
  describe('calculateCost', () => {
    it('calculates cost for known model', () => {
      // 1000 input tokens at $3/MTok = $0.003
      // 500 output tokens at $15/MTok = $0.0075
      const cost = calculateCost('claude-sonnet-4-20250514', 1000, 500)
      expect(cost).toBeCloseTo(0.0105, 6)
    })

    it('calculates cost for opus model', () => {
      // 1000 input at $15/MTok = $0.015
      // 1000 output at $75/MTok = $0.075
      const cost = calculateCost('claude-opus-4-20250514', 1000, 1000)
      expect(cost).toBeCloseTo(0.09, 6)
    })

    it('calculates cost for haiku model', () => {
      // 1000 input at $1/MTok = $0.001
      // 1000 output at $5/MTok = $0.005
      const cost = calculateCost('claude-haiku-4-5-20251001', 1000, 1000)
      expect(cost).toBeCloseTo(0.006, 6)
    })

    it('uses default pricing for unknown model', () => {
      // Default = sonnet pricing ($3/$15)
      const cost = calculateCost('unknown-model', 1000, 500)
      const expected = (1000 / 1_000_000) * DEFAULT_PRICING.inputPerMTok
        + (500 / 1_000_000) * DEFAULT_PRICING.outputPerMTok
      expect(cost).toBeCloseTo(expected, 6)
    })

    it('returns 0 for zero tokens', () => {
      expect(calculateCost('claude-sonnet-4-20250514', 0, 0)).toBe(0)
    })

    it('handles large token counts', () => {
      // 1M input at $3/MTok = $3, 1M output at $15/MTok = $15
      const cost = calculateCost('claude-sonnet-4-20250514', 1_000_000, 1_000_000)
      expect(cost).toBeCloseTo(18, 4)
    })
  })

  describe('MODEL_PRICING', () => {
    it('has entries for sonnet, haiku, and opus', () => {
      expect(MODEL_PRICING['claude-sonnet-4-20250514']).toBeDefined()
      expect(MODEL_PRICING['claude-haiku-4-5-20251001']).toBeDefined()
      expect(MODEL_PRICING['claude-opus-4-20250514']).toBeDefined()
    })

    it('has positive pricing values', () => {
      for (const [, pricing] of Object.entries(MODEL_PRICING)) {
        expect(pricing.inputPerMTok).toBeGreaterThan(0)
        expect(pricing.outputPerMTok).toBeGreaterThan(0)
      }
    })
  })

  describe('IdeationAgentConfig shape', () => {
    it('makeConfig produces valid config', () => {
      const config = makeConfig()
      expect(config.id).toBe('test-agent')
      expect(config.name).toBe('Test Agent')
      expect(config.tier).toBe('production')
      expect(config.model.primary).toBe('claude-sonnet-4-20250514')
      expect(config.model.fallback).toBe('claude-haiku-4-5-20251001')
      expect(config.maxRetries).toBe(2)
      expect(config.timeoutMs).toBe(30000)
    })

    it('allows overrides', () => {
      const config = makeConfig({ id: 'custom', tier: 'governance', maxRetries: 5 })
      expect(config.id).toBe('custom')
      expect(config.tier).toBe('governance')
      expect(config.maxRetries).toBe(5)
    })
  })
})

// ─── Registry Tests ────────────────────────────────────────────────────────

describe('Agent Registry', () => {
  beforeEach(() => {
    clearAgents()
  })

  it('registers and retrieves an agent', () => {
    const config = makeConfig()
    registerAgent(config)
    expect(getAgent('test-agent')).toEqual(config)
  })

  it('returns undefined for unregistered agent', () => {
    expect(getAgent('nonexistent')).toBeUndefined()
  })

  it('throws on duplicate registration', () => {
    registerAgent(makeConfig())
    expect(() => registerAgent(makeConfig())).toThrow('Agent already registered: test-agent')
  })

  it('lists all registered agents', () => {
    registerAgent(makeConfig({ id: 'agent-a', name: 'Agent A' }))
    registerAgent(makeConfig({ id: 'agent-b', name: 'Agent B' }))
    registerAgent(makeConfig({ id: 'agent-c', name: 'Agent C' }))
    const list = listAgents()
    expect(list).toHaveLength(3)
    expect(list.map(a => a.id)).toEqual(['agent-a', 'agent-b', 'agent-c'])
  })

  it('returns empty array when no agents registered', () => {
    expect(listAgents()).toEqual([])
  })

  it('clearAgents removes all agents', () => {
    registerAgent(makeConfig({ id: 'a', name: 'A' }))
    registerAgent(makeConfig({ id: 'b', name: 'B' }))
    clearAgents()
    expect(listAgents()).toEqual([])
    expect(getAgent('a')).toBeUndefined()
  })

  it('allows re-registration after clear', () => {
    const config = makeConfig()
    registerAgent(config)
    clearAgents()
    registerAgent(config) // should not throw
    expect(getAgent('test-agent')).toEqual(config)
  })
})

// ─── Executor Tests ────────────────────────────────────────────────────────

describe('Agent Executor', () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    mockCreate.mockReset()
    // Reset the cached client so each test gets a fresh one
    // We dynamically import to get the resetClient function
  })

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalEnv
  })

  async function getExecutor() {
    // Dynamic import to re-evaluate after env changes
    const mod = await import('../../src/lib/domain/workflows/agents/framework/executor')
    mod.resetClient()
    return mod
  }

  it('returns error when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const { executeIdeationAgent } = await getExecutor()

    const result = await executeIdeationAgent<string>(
      makeConfig(),
      'You are a test agent.',
      'Say hello'
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('ANTHROPIC_API_KEY is not set')
    expect(result.agentId).toBe('test-agent')
    expect(result.tokensIn).toBe(0)
    expect(result.tokensOut).toBe(0)
    expect(result.costUSD).toBe(0)
    expect(result.output).toBeNull()
  })

  it('returns typed string result on success', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-123'
    const { executeIdeationAgent } = await getExecutor()

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Hello from the agent!' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    })

    const result = await executeIdeationAgent<string>(
      makeConfig(),
      'You are a test agent.',
      'Say hello'
    )

    expect(result.success).toBe(true)
    expect(result.output).toBe('Hello from the agent!')
    expect(result.agentId).toBe('test-agent')
    expect(result.modelUsed).toBe('claude-sonnet-4-20250514')
    expect(result.tokensIn).toBe(100)
    expect(result.tokensOut).toBe(50)
    expect(result.costUSD).toBeGreaterThan(0)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(result.error).toBeUndefined()
  })

  it('tracks cost correctly for known model', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-123'
    const { executeIdeationAgent } = await getExecutor()

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'result' }],
      usage: { input_tokens: 1000, output_tokens: 500 },
    })

    const result = await executeIdeationAgent<string>(
      makeConfig(),
      'system',
      'user'
    )

    // sonnet: 1000 * $3/MTok + 500 * $15/MTok = $0.003 + $0.0075 = $0.0105
    expect(result.costUSD).toBeCloseTo(0.0105, 6)
  })

  it('parses JSON output when outputSchema is provided', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-123'
    const { executeIdeationAgent } = await getExecutor()

    interface TestOutput {
      name: string
      score: number
    }

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"name": "Test", "score": 95}' }],
      usage: { input_tokens: 200, output_tokens: 30 },
    })

    const result = await executeIdeationAgent<TestOutput>(
      makeConfig(),
      'Return JSON.',
      'Give me a name and score.',
      { type: 'object', properties: { name: { type: 'string' }, score: { type: 'number' } } }
    )

    expect(result.success).toBe(true)
    expect(result.output).toEqual({ name: 'Test', score: 95 })
  })

  it('strips markdown fences from JSON output', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-123'
    const { executeIdeationAgent } = await getExecutor()

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '```json\n{"key": "value"}\n```' }],
      usage: { input_tokens: 100, output_tokens: 20 },
    })

    const result = await executeIdeationAgent<{ key: string }>(
      makeConfig(),
      'Return JSON.',
      'Give me JSON.',
      { type: 'object', properties: { key: { type: 'string' } } }
    )

    expect(result.success).toBe(true)
    expect(result.output).toEqual({ key: 'value' })
  })

  it('falls back to secondary model when primary fails', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-123'
    const { executeIdeationAgent } = await getExecutor()

    // Primary fails all retries (maxRetries=2, so 3 attempts)
    mockCreate
      .mockRejectedValueOnce(new Error('Primary overloaded'))
      .mockRejectedValueOnce(new Error('Primary overloaded'))
      .mockRejectedValueOnce(new Error('Primary overloaded'))
      // Fallback succeeds
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Fallback response' }],
        usage: { input_tokens: 80, output_tokens: 20 },
      })

    const result = await executeIdeationAgent<string>(
      makeConfig(),
      'system',
      'user'
    )

    expect(result.success).toBe(true)
    expect(result.output).toBe('Fallback response')
    expect(result.modelUsed).toBe('claude-haiku-4-5-20251001')
  })

  it('retries on transient failure before succeeding', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-123'
    const { executeIdeationAgent } = await getExecutor()

    mockCreate
      .mockRejectedValueOnce(new Error('Transient error'))
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Success after retry' }],
        usage: { input_tokens: 100, output_tokens: 30 },
      })

    const result = await executeIdeationAgent<string>(
      makeConfig(),
      'system',
      'user'
    )

    expect(result.success).toBe(true)
    expect(result.output).toBe('Success after retry')
    expect(result.modelUsed).toBe('claude-sonnet-4-20250514')
  })

  it('returns error when all models and retries exhausted', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-123'
    const { executeIdeationAgent } = await getExecutor()

    // All attempts fail (primary 3x + fallback 3x = 6 calls)
    mockCreate.mockRejectedValue(new Error('All down'))

    const result = await executeIdeationAgent<string>(
      makeConfig(),
      'system',
      'user'
    )

    expect(result.success).toBe(false)
    expect(result.output).toBeNull()
    expect(result.error).toContain('All models failed')
  })

  it('passes timeout to Anthropic API call', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-123'
    const { executeIdeationAgent } = await getExecutor()

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })

    await executeIdeationAgent<string>(
      makeConfig({ timeoutMs: 45000 }),
      'system',
      'user'
    )

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-4-20250514' }),
      expect.objectContaining({ timeout: 45000 })
    )
  })

  it('sends system prompt and user message correctly', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-123'
    const { executeIdeationAgent } = await getExecutor()

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })

    await executeIdeationAgent<string>(
      makeConfig(),
      'You are an audience analyst.',
      'Analyze this brief: teach teachers about instructional design'
    )

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'You are an audience analyst.',
        messages: [{ role: 'user', content: 'Analyze this brief: teach teachers about instructional design' }],
      }),
      expect.any(Object)
    )
  })

  it('result has all required AgentResult fields', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-123'
    const { executeIdeationAgent } = await getExecutor()

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'output' }],
      usage: { input_tokens: 50, output_tokens: 25 },
    })

    const result: AgentResult<string> = await executeIdeationAgent<string>(
      makeConfig(),
      'system',
      'user'
    )

    // Verify every field exists and has correct type
    expect(typeof result.agentId).toBe('string')
    expect(typeof result.success).toBe('boolean')
    expect(typeof result.durationMs).toBe('number')
    expect(typeof result.modelUsed).toBe('string')
    expect(typeof result.tokensIn).toBe('number')
    expect(typeof result.tokensOut).toBe('number')
    expect(typeof result.costUSD).toBe('number')
  })
})
