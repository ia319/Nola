import type { UploadItem } from '@/features/upload/types'
import { useTranslation } from 'react-i18next'

import logger from '@/config/logger'
import { UploadProgress } from './UploadProgress'

export interface UploadListProps {
  uploads: UploadItem[]
  onCancel: (id: string) => void
  onRetry: (id: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
}

/**
 * Render a list of UploadProgress items. Returns null when the list is empty.
 */
export function UploadList({ uploads, onCancel, onRetry, onRemove }: UploadListProps) {
  const { t } = useTranslation()

  if (uploads.length === 0) return null

  return (
    <div data-slot="upload-list" className="flex flex-col">
      <div className="text-muted-foreground grid grid-cols-[minmax(0,1.4fr)_minmax(8rem,1fr)_5.5rem_auto] gap-4 border-b px-5 py-3 text-[11px] font-semibold tracking-[0.24em] uppercase">
        <span>{t('tasks.uploadQueue.table.fileName')}</span>
        <span>{t('tasks.uploadQueue.table.status')}</span>
        <span>{t('tasks.uploadQueue.table.size')}</span>
        <span className="text-right">{t('tasks.uploadQueue.table.action')}</span>
      </div>

      {uploads.map((item) => (
        <UploadProgress
          key={item.id}
          fileName={item.file.name}
          fileSize={item.file.size}
          progress={item.progress}
          status={item.status}
          errorKey={item.error?.i18nKey}
          errorParams={item.error?.params}
          onCancel={() => onCancel(item.id)}
          onRetry={() => {
            onRetry(item.id).catch((e) => logger.warn('retryUpload unexpected', e))
          }}
          onRemove={() => {
            onRemove(item.id).catch((e) => logger.warn('removeFile unexpected', e))
          }}
        />
      ))}
    </div>
  )
}
