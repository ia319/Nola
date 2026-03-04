import type { UploadItem } from '@/features/upload/types'
import { UploadProgress } from './UploadProgress'

interface UploadListProps {
  uploads: UploadItem[]
  onCancel: (id: string) => void
  onRetry: (id: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
}

/**
 * Render a list of UploadProgress items. Returns null when the list is empty.
 */
export function UploadList({ uploads, onCancel, onRetry, onRemove }: UploadListProps) {
  if (uploads.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
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
          onRetry={() => onRetry(item.id)}
          onRemove={() => onRemove(item.id)}
        />
      ))}
    </div>
  )
}
