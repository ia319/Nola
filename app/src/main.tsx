import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'

import { getLocaleFromPath } from '@/app/locale/locale-routing'
import { hydrateUiPreferences } from '@/app/locale/ui-preferences-store'
import { ThemeProvider } from '@/components/theme-provider'
import { initializeI18n } from '@/i18n'
import './index.css'
import { router } from './router'
import { queryClient } from './shared/lib/query-client'

async function bootstrapApplication(): Promise<void> {
  const preferences = await hydrateUiPreferences()
  const routeLocale = getLocaleFromPath(window.location.pathname)
  await initializeI18n(routeLocale ?? preferences.language)

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>,
  )
}

void bootstrapApplication()
