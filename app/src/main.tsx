import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'

import { getLocaleFromPath } from '@/app/locale/locale-routing'
import { hydrateUiPreferences } from '@/app/locale/ui-preferences-store'
import { BootstrapErrorFallback } from '@/components/bootstrap-error-fallback'
import { ThemeProvider } from '@/components/theme-provider'
import { initializeI18n } from '@/i18n'
import './index.css'
import { router } from './router'
import { queryClient } from './shared/lib/query-client'

function renderApplication(root: Root): void {
  root.render(
    <StrictMode>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>,
  )
}

function renderBootstrapError(root: Root): void {
  root.render(
    <StrictMode>
      <BootstrapErrorFallback />
    </StrictMode>,
  )
}

async function bootstrapApplication(root: Root): Promise<void> {
  const preferences = await hydrateUiPreferences()
  const routeLocale = getLocaleFromPath(window.location.pathname)
  await initializeI18n(routeLocale ?? preferences.language)

  renderApplication(root)
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

const root = createRoot(rootElement)

void bootstrapApplication(root).catch((error: unknown) => {
  console.error('bootstrap.failed', error)
  renderBootstrapError(root)
})
