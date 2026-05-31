import { describe, it, expect } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import {
  parseWebSearchContent,
  readSearchCount,
  WEB_SEARCH_COST_PER_CALL,
} from '../../../src/lib/core/agentic/adapters/web-search-adapter'

// Build a minimal content array shaped like Anthropic's response blocks.
// parseWebSearchContent only reads .type/.text/.citations/.content, so a
// structural fixture cast through unknown exercises the real parsing logic.
function content(blocks: unknown[]): Anthropic.ContentBlock[] {
  return blocks as Anthropic.ContentBlock[]
}

describe('parseWebSearchContent', () => {
  it('extracts text and sources from search-result blocks', () => {
    const { text, sources } = parseWebSearchContent(
      content([
        { type: 'text', text: 'Agentic AI is on the rise.', citations: null },
        {
          type: 'web_search_tool_result',
          tool_use_id: 't1',
          content: [
            { type: 'web_search_result', url: 'https://a.com/x', title: 'A', page_age: '2024-01-01' },
            { type: 'web_search_result', url: 'https://b.com/y', title: 'B', page_age: null },
          ],
        },
      ])
    )
    expect(text).toBe('Agentic AI is on the rise.')
    expect(sources).toHaveLength(2)
    expect(sources[0]).toEqual({
      url: 'https://a.com/x',
      title: 'A',
      pageAge: '2024-01-01',
      snippet: '',
    })
    expect(sources[1].pageAge).toBeNull()
  })

  it('de-duplicates sources by URL across blocks (first-seen wins)', () => {
    const { sources } = parseWebSearchContent(
      content([
        {
          type: 'web_search_tool_result',
          tool_use_id: 't1',
          content: [{ type: 'web_search_result', url: 'https://a.com/x', title: 'First', page_age: null }],
        },
        {
          type: 'web_search_tool_result',
          tool_use_id: 't2',
          content: [{ type: 'web_search_result', url: 'https://a.com/x', title: 'Second', page_age: null }],
        },
      ])
    )
    expect(sources).toHaveLength(1)
    expect(sources[0].title).toBe('First')
  })

  it('backfills snippets from web_search citations by URL', () => {
    const { sources } = parseWebSearchContent(
      content([
        {
          type: 'text',
          text: 'Grounded claim.',
          citations: [
            {
              type: 'web_search_result_location',
              url: 'https://a.com/x',
              title: 'A',
              cited_text: 'the relevant excerpt',
              encrypted_index: 'idx',
            },
          ],
        },
        {
          type: 'web_search_tool_result',
          tool_use_id: 't1',
          content: [{ type: 'web_search_result', url: 'https://a.com/x', title: 'A', page_age: null }],
        },
      ])
    )
    expect(sources[0].snippet).toBe('the relevant excerpt')
  })

  it('tolerates a search-result error block without throwing', () => {
    const { sources } = parseWebSearchContent(
      content([
        {
          type: 'web_search_tool_result',
          tool_use_id: 't1',
          content: { type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' },
        },
      ])
    )
    expect(sources).toHaveLength(0)
  })
})

describe('readSearchCount', () => {
  it('reads web_search_requests from usage', () => {
    const usage = { server_tool_use: { web_search_requests: 4, web_fetch_requests: 0 } }
    expect(readSearchCount(usage as unknown as Anthropic.Usage)).toBe(4)
  })

  it('returns 0 when server_tool_use is null', () => {
    expect(readSearchCount({ server_tool_use: null } as unknown as Anthropic.Usage)).toBe(0)
  })
})

describe('WEB_SEARCH_COST_PER_CALL', () => {
  it('reflects Anthropic $10 / 1000 searches pricing', () => {
    expect(WEB_SEARCH_COST_PER_CALL).toBe(0.01)
  })
})
