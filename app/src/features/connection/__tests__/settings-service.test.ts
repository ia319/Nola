import { describe, expect, it } from 'vitest'

import { isCspViolationForOrigin } from '../settings-service'

function createSecurityPolicyViolationEvent(blockedURI?: string): Event {
  const event = new Event('securitypolicyviolation') as Event & {
    blockedURI?: string
  }
  if (blockedURI !== undefined) {
    event.blockedURI = blockedURI
  }
  return event
}

describe('connection settings service', () => {
  it('matches CSP violations only when blockedURI targets the checked origin', () => {
    expect(
      isCspViolationForOrigin(
        createSecurityPolicyViolationEvent('https://nola.example.com/api/config'),
        'https://nola.example.com',
      ),
    ).toBe(true)

    expect(
      isCspViolationForOrigin(
        createSecurityPolicyViolationEvent('https://other.example.com/api/config'),
        'https://nola.example.com',
      ),
    ).toBe(false)
    expect(
      isCspViolationForOrigin(createSecurityPolicyViolationEvent(), 'https://nola.example.com'),
    ).toBe(false)
    expect(
      isCspViolationForOrigin(
        createSecurityPolicyViolationEvent('inline'),
        'https://nola.example.com',
      ),
    ).toBe(false)
  })
})
