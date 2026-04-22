import type { CSSProperties } from 'react'
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

import { useTheme } from '@/components/use-theme'
import { cn } from '@/lib/utils'

type ToasterStyle = CSSProperties & {
  '--normal-bg': string
  '--normal-text': string
  '--normal-border': string
  '--border-radius': string
}

const Toaster = ({ theme: _ignoredTheme, className, icons, style, ...props }: ToasterProps) => {
  const { resolvedTheme, theme = 'system' } = useTheme()
  const activeTheme: NonNullable<ToasterProps['theme']> =
    theme === 'system' ? (resolvedTheme ?? 'system') : theme
  const baseStyle: ToasterStyle = {
    '--normal-bg': 'var(--popover)',
    '--normal-text': 'var(--popover-foreground)',
    '--normal-border': 'var(--border)',
    '--border-radius': 'var(--radius)',
  }

  return (
    <Sonner
      {...props}
      theme={activeTheme}
      className={cn('toaster group', className)}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
        ...icons,
      }}
      style={{ ...baseStyle, ...style }}
    />
  )
}

export { Toaster }
