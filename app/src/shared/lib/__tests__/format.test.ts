import { describe, expect, it } from 'vitest'
import { formatFileSize } from '../format'

describe('formatFileSize', () => {
  it('should return "0 B" for zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })

  it('should display bytes without decimal', () => {
    expect(formatFileSize(1023)).toBe('1023 B')
  })

  it('should format exactly 1024 bytes as KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
  })

  it('should format 1 MB with one decimal', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
  })

  it('should return "0 B" for negative values', () => {
    expect(formatFileSize(-1)).toBe('0 B')
  })

  it('should return "0 B" for NaN', () => {
    expect(formatFileSize(NaN)).toBe('0 B')
  })

  it('should format 500 MB correctly', () => {
    expect(formatFileSize(500 * 1024 * 1024)).toBe('500.0 MB')
  })

  it('should format 1.5 GB correctly', () => {
    expect(formatFileSize(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB')
  })
})
