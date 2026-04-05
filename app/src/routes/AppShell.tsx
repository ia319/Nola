import { Link, Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Toaster } from 'sonner'

import { buttonVariants } from '@/components/ui/button'
import { useTaskPolling } from '@/features/tasks'

export function AppShell() {
  const { t } = useTranslation()
  useTaskPolling()

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <nav className="flex flex-wrap gap-2">
        <Link to="/" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          {t('tasks.currentBatch.title')}
        </Link>
        <Link to="/history" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          {t('tasks.history.title')}
        </Link>
        <Link to="/models" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          {t('models.title')}
        </Link>
      </nav>

      <Outlet />
      <Toaster />
    </div>
  )
}
