import { describe, it, expect } from 'vitest'
import {
  notEmpty,
  wordCount,
  completenessCheck,
  noPlaceholderContent,
  runValidators,
  toStageValidator,
} from './text-validators'
import { createTextValidators } from './index'

// ─── notEmpty ─────────────────────────────────────────────────────────────

describe('notEmpty', () => {
  const v = notEmpty()

  it('fails on empty string', () => {
    expect(v('').pass).toBe(false)
  })

  it('fails on whitespace-only string', () => {
    expect(v('   \n\t  ').pass).toBe(false)
  })

  it('fails on null', () => {
    expect(v(null).pass).toBe(false)
  })

  it('fails on undefined', () => {
    expect(v(undefined).pass).toBe(false)
  })

  it('passes on real text', () => {
    const r = v('Hello world.')
    expect(r.pass).toBe(true)
    expect(r.name).toBe('notEmpty')
  })

  it('passes on artifact object with content field', () => {
    expect(v({ content: 'Hello.' }).pass).toBe(true)
  })
})

// ─── wordCount ────────────────────────────────────────────────────────────

describe('wordCount', () => {
  it('fails when below default minimum (200)', () => {
    const text = 'word '.repeat(50).trim()
    const r = wordCount()(text)
    expect(r.pass).toBe(false)
    expect(r.message).toContain('below')
  })

  it('fails when above default maximum (10,000)', () => {
    const text = 'word '.repeat(15_000).trim()
    const r = wordCount()(text)
    expect(r.pass).toBe(false)
    expect(r.message).toContain('exceeds')
  })

  it('passes at 500 words', () => {
    const text = 'word '.repeat(500).trim()
    expect(wordCount()(text).pass).toBe(true)
  })

  it('respects custom min/max', () => {
    const v = wordCount({ min: 5, max: 10 })
    expect(v('one two three').pass).toBe(false)
    expect(v('one two three four five six seven').pass).toBe(true)
    expect(
      v('one two three four five six seven eight nine ten eleven').pass
    ).toBe(false)
  })

  it('passes exactly at boundaries', () => {
    const v = wordCount({ min: 3, max: 5 })
    expect(v('one two three').pass).toBe(true)
    expect(v('one two three four five').pass).toBe(true)
  })
})

// ─── completenessCheck ────────────────────────────────────────────────────

describe('completenessCheck', () => {
  const v = completenessCheck()

  it('fails on text ending mid-word', () => {
    expect(v('This is an incomplete senten').pass).toBe(false)
  })

  it('fails on text ending with ellipsis', () => {
    expect(v('So as we were saying...').pass).toBe(false)
  })

  it('fails on unicode ellipsis', () => {
    expect(v('trailing\u2026').pass).toBe(false)
  })

  it('passes on text ending with period', () => {
    expect(v('Finished.').pass).toBe(true)
  })

  it('passes on text ending with exclamation', () => {
    expect(v('Wow!').pass).toBe(true)
  })

  it('passes on text ending with question mark', () => {
    expect(v('Really?').pass).toBe(true)
  })

  it('passes on text ending with closing quote', () => {
    expect(v('He said "yes"').pass).toBe(true)
  })

  it('passes on text ending with closing paren', () => {
    expect(v('Details here (see above)').pass).toBe(true)
  })

  it('passes on text ending with closing code brace', () => {
    expect(v('function foo() { return 1 }').pass).toBe(true)
  })

  it('tolerates trailing whitespace/newlines', () => {
    expect(v('Finished.  \n\n').pass).toBe(true)
  })

  it('fails on empty content', () => {
    expect(v('').pass).toBe(false)
  })
})

// ─── noPlaceholderContent ─────────────────────────────────────────────────

describe('noPlaceholderContent', () => {
  const v = noPlaceholderContent()

  it('fails on [TODO] marker', () => {
    expect(v('Intro. [TODO] fill this in.').pass).toBe(false)
  })

  it('fails case-insensitively on [todo]', () => {
    expect(v('Intro. [todo] fill this in.').pass).toBe(false)
  })

  it('fails on Lorem ipsum', () => {
    expect(v('Lorem ipsum dolor sit amet.').pass).toBe(false)
  })

  it('fails on [INSERT EXAMPLE HERE]', () => {
    expect(v('See [INSERT EXAMPLE HERE] for details.').pass).toBe(false)
  })

  it('fails on [PLACEHOLDER]', () => {
    expect(v('x [PLACEHOLDER] y').pass).toBe(false)
  })

  it('passes on clean article text', () => {
    expect(
      v(
        'Photosynthesis converts sunlight into chemical energy stored in glucose.'
      ).pass
    ).toBe(true)
  })
})

// ─── Integration with runner / engine bridge ──────────────────────────────

describe('createTextValidators + runValidators', () => {
  const goodArticle =
    'Photosynthesis converts sunlight into chemical energy. ' +
      'It occurs primarily in the chloroplasts of plant cells. ' +
      'The process has two stages: light-dependent and light-independent reactions. '.repeat(
        30
      ) +
    'This concludes the overview.'

  it('all 4 validators pass on a known-good article', () => {
    const validators = createTextValidators()
    const results = runValidators(validators, goodArticle)
    expect(results).toHaveLength(4)
    for (const r of results) {
      expect(r.pass).toBe(true)
    }
  })

  it('at least 2 validators fail on truncated garbage', () => {
    const garbage = '[TODO] write this sect'
    const validators = createTextValidators()
    const results = runValidators(validators, garbage)
    const failures = results.filter((r) => !r.pass)
    expect(failures.length).toBeGreaterThanOrEqual(2)
  })

  it('toStageValidator adapts to engine ValidationResult shape', () => {
    const stageValidator = toStageValidator(createTextValidators())
    const good = stageValidator(goodArticle)
    expect(good.valid).toBe(true)
    expect(good.errors).toHaveLength(0)

    const bad = stageValidator('[TODO] short')
    expect(bad.valid).toBe(false)
    expect(bad.errors.length).toBeGreaterThanOrEqual(2)
    expect(bad.errors[0]).toHaveProperty('code')
    expect(bad.errors[0]).toHaveProperty('message')
  })
})
