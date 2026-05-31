import { describe, it, expect } from 'vitest'
import {
  startIdeationSchema,
  sendMessageSchema,
  triggerGradeSchema,
  approveSchema,
} from '../../src/lib/validations/ideation'

describe('ideation validation schemas', () => {
  describe('startIdeationSchema', () => {
    it('accepts valid brief', () => {
      const result = startIdeationSchema.safeParse({ brief: 'Create a 10-video science course for grade 8' })
      expect(result.success).toBe(true)
    })

    it('rejects brief shorter than 10 characters', () => {
      const result = startIdeationSchema.safeParse({ brief: 'short' })
      expect(result.success).toBe(false)
    })

    it('rejects missing brief', () => {
      const result = startIdeationSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('sendMessageSchema', () => {
    it('accepts non-empty message', () => {
      const result = sendMessageSchema.safeParse({ message: 'Focus on biology and chemistry' })
      expect(result.success).toBe(true)
    })

    it('rejects empty message', () => {
      const result = sendMessageSchema.safeParse({ message: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('triggerGradeSchema', () => {
    it('accepts empty object', () => {
      const result = triggerGradeSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('accepts force flag', () => {
      const result = triggerGradeSchema.safeParse({ force: true })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.force).toBe(true)
      }
    })
  })

  describe('approveSchema', () => {
    it('accepts approve action', () => {
      const result = approveSchema.safeParse({ action: 'approve' })
      expect(result.success).toBe(true)
    })

    it('accepts feedback with message', () => {
      const result = approveSchema.safeParse({
        action: 'feedback',
        message: 'Add more hands-on activities',
      })
      expect(result.success).toBe(true)
    })

    it('accepts restructure action', () => {
      const result = approveSchema.safeParse({ action: 'restructure' })
      expect(result.success).toBe(true)
    })

    it('rejects invalid action', () => {
      const result = approveSchema.safeParse({ action: 'reject' })
      expect(result.success).toBe(false)
    })

    it('defaults message to empty string', () => {
      const result = approveSchema.safeParse({ action: 'approve' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.message).toBe('')
      }
    })
  })
})
