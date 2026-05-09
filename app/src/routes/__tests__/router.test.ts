import { describe, expect, it } from 'vitest'

import { router } from '@/router'

function getRegisteredRoutePaths(): string[] {
  return Object.values(router.routesById).map((route) => route.fullPath)
}

describe('router', () => {
  it('registers live workbench routes', () => {
    expect(getRegisteredRoutePaths()).toEqual(expect.arrayContaining(['/live', '/$locale/live']))
  })
})
