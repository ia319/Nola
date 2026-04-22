import { describe, expect, it } from 'vitest'

import { getLocaleFromPath, localizePath, stripLocalePrefix } from '@/app/locale/locale-routing'

describe('locale-routing', () => {
  it('reads the leading locale segment only when it matches one supported ui language', () => {
    expect(getLocaleFromPath('/zh/settings/general')).toBe('zh')
    expect(getLocaleFromPath('/en/models')).toBe('en')
    expect(getLocaleFromPath('/fr/models')).toBeNull()
    expect(getLocaleFromPath('/settings/general')).toBeNull()
    expect(getLocaleFromPath('')).toBeNull()
  })

  it('removes the locale prefix while keeping the route path stable', () => {
    expect(stripLocalePrefix('/zh/settings/general')).toBe('/settings/general')
    expect(stripLocalePrefix('/en')).toBe('/')
    expect(stripLocalePrefix('/zh/')).toBe('/')
    expect(stripLocalePrefix('/models')).toBe('/models')
  })

  it('adds one locale prefix without duplicating an existing one', () => {
    expect(localizePath('/settings/general', 'zh')).toBe('/zh/settings/general')
    expect(localizePath('/zh/settings/general', 'en')).toBe('/en/settings/general')
    expect(localizePath('/', 'en')).toBe('/en')
    expect(localizePath('', 'zh')).toBe('/zh')
    expect(localizePath('/zh/models', null)).toBe('/models')
  })
})
