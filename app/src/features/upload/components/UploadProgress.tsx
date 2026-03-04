import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, Ban, X } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import type { UploadStatus } from '@/features/upload/types'
import { formatFileSize } from '@/shared/lib/format'

interface UploadProgressProps {
  fileName: string
  fileSize: number
  progress: number
  status: UploadStatus
  errorKey?: string
  errorParams?: Record<string, unknown>
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

  return (
    <div className="bg-card flex items-center gap-3 rounded-lg border p-3">
      {/* Status icon */}
      <div className="shrink-0">
        {status === 'success' && <CheckCircle2 className="size-5 text-emerald-500" />}
        {status === 'error' && <XCircle className="text-destructive size-5" />}
        {status === 'cancelled' && <Ban className="text-muted-foreground size-5" />}
        {(status === 'uploading' || status === 'pending') && (
          <div className="border-primary size-5 animate-spin rounded-full border-2 border-t-transparent" />
        )}
      </div>

      {/* File info and progress */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium">{fileName}</p>
          <span className="text-muted-foreground shrink-0 text-xs">{formatFileSize(fileSize)}</span>
        </div>

        {status === 'uploading' && (
          <div className="mt-1.5 flex items-center gap-2">
            <Progress value={progress} className="h-1.5" />
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{progress}%</span>
          </div>
        )}

        {status === 'error' && (
          <p className="text-destructive mt-1 text-xs">
            {errorKey
              ? t(errorKey, { ...errorParams, defaultValue: t('upload.progress.error') })
              : t('upload.progress.error')}
          </p>
        )}

        {status === 'success' && (
          <p className="mt-1 text-xs text-emerald-600">{t('upload.progress.success')}</p>
        )}

        {status === 'cancelled' && (
          <p className="text-muted-foreground mt-1 text-xs">{t('upload.progress.cancelled')}</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex shrink-0 gap-1">
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
          <Button variant="ghost" size="xs" onClick={onRetry}>
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
