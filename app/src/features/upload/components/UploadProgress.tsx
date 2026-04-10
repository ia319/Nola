import { useTranslation } from 'react-i18next'
import { RefreshCcw, X } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import type { UploadStatus } from '@/features/upload/types'
import { formatFileSize } from '@/shared/lib/format'
import type { AppError } from '@/shared/types'
import { cn } from '@/lib/utils'

interface UploadProgressProps {
  fileName: string
  fileSize: number
  progress: number
  status: UploadStatus
  errorKey?: string
  errorParams?: AppError['params']
  onCancel?: () => void
  onRetry?: () => void
  onRemove?: () => void
}

/**
 * Display upload state for a single file: progress bar, status icon, and action buttons.
 */
export function UploadProgress({
  fileName,
  fileSize,
  progress,
  status,
  errorKey,
  errorParams,
  onCancel,
  onRetry,
  onRemove,
}: UploadProgressProps) {
  const { t } = useTranslation()
  const statusLabel = (() => {
    switch (status) {
      case 'pending':
        return t('tasks.uploadQueue.status.pending')
      case 'uploading':
        return t('tasks.uploadQueue.status.uploading')
      case 'success':
        return t('tasks.uploadQueue.status.ready')
      case 'error':
        return t('tasks.uploadQueue.status.failed')
      case 'cancelled':
        return t('tasks.uploadQueue.status.cancelled')
      default:
        return status
    }
  })()

  const errorText = errorKey
    ? t(errorKey, { ...errorParams, defaultValue: t('upload.progress.error') })
    : t('upload.progress.error')

  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1.4fr)_minmax(8rem,1fr)_5.5rem_auto] items-center gap-4 px-5 py-4',
        status === 'error' && 'bg-surface-container-lowest/30',
      )}
    >
      <div className="min-w-0 space-y-1">
        <p
          className={cn(
            'truncate text-sm font-medium',
            status === 'error' && 'text-muted-foreground italic',
          )}
        >
          {fileName}
        </p>

        {status === 'error' ? (
          <p className="text-destructive line-clamp-1 text-xs">{errorText}</p>
        ) : status === 'cancelled' ? (
          <p className="text-muted-foreground text-xs">{t('upload.progress.cancelled')}</p>
        ) : null}
      </div>

      <div className="min-w-0">
        {status === 'uploading' ? (
          <div className="flex max-w-32 flex-col gap-2">
            <Progress value={progress} className="h-1.5" />
            <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
              {progress}% {statusLabel}
            </span>
          </div>
        ) : (
          <span className="bg-surface-container text-muted-foreground inline-flex min-h-6 items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-[0.18em] uppercase">
            {statusLabel}
          </span>
        )}
      </div>

      <span className="text-muted-foreground text-sm tabular-nums">{formatFileSize(fileSize)}</span>

      <div className="flex shrink-0 justify-end gap-1">
        {status === 'uploading' && onCancel && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onCancel}
            aria-label={t('upload.progress.cancel')}
          >
            <X className="size-3.5" />
          </Button>
        )}

        {(status === 'error' || status === 'cancelled') && onRetry && (
          <Button variant="ghost" size="xs" onClick={onRetry} className="uppercase">
            <RefreshCcw className="size-3" />
            {t('upload.progress.retry')}
          </Button>
        )}

        {status !== 'uploading' && onRemove && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onRemove}
            aria-label={t('upload.progress.remove')}
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
