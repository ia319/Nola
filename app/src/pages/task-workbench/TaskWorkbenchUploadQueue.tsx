import { CloudUpload, Plus, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/ui'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FileUploader, UploadList } from '@/features/upload'
import type { UploadItem } from '@/features/upload'
import { formatFileSize } from '@/shared/lib/format'

export interface TaskWorkbenchUploadQueueProps {
  uploads: UploadItem[]
  maxFileSize: number
  isUploading: boolean
  hasPending: boolean
  onFilesSelected: (files: File[]) => void
  onCancelUpload: (id: string) => void
  onRetryUpload: (id: string) => Promise<void>
  onRemoveUpload: (id: string) => Promise<void>
  onStartUpload: () => Promise<void>
  onReset: () => Promise<void>
}

export function TaskWorkbenchUploadQueue({
  uploads,
  maxFileSize,
  isUploading,
  hasPending,
  onFilesSelected,
  onCancelUpload,
  onRetryUpload,
  onRemoveUpload,
  onStartUpload,
  onReset,
}: TaskWorkbenchUploadQueueProps) {
  const { t } = useTranslation()
  const hasUploads = uploads.length > 0

  return (
    <section data-slot="task-workbench-upload-queue" className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          {t('tasks.workbench.sections.uploadQueue.title')}
        </h2>
        <p className="text-muted-foreground text-xs">
          {t('tasks.workbench.sections.uploadQueue.maxFileSize', {
            maxSize: formatFileSize(maxFileSize),
          })}
        </p>
      </div>

      {hasUploads ? (
        <Card className="flex min-h-[28rem] flex-1 flex-col gap-0 overflow-hidden py-0">
          <CardContent className="flex flex-1 flex-col px-0 py-0">
            <div className="min-h-0 flex-1 overflow-auto">
              <UploadList
                uploads={uploads}
                onCancel={onCancelUpload}
                onRetry={onRetryUpload}
                onRemove={onRemoveUpload}
              />
            </div>

            <div className="bg-surface-container-lowest flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
              <FileUploader
                onFilesSelected={onFilesSelected}
                disabled={isUploading}
                ariaLabel={t('tasks.uploadQueue.actions.addMoreFiles')}
                className="text-muted-foreground hover:text-foreground min-h-0 items-start justify-start gap-0 border-0 bg-transparent p-0 shadow-none hover:bg-transparent"
              >
                <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.22em] uppercase">
                  <Upload className="size-3.5" />
                  {t('tasks.uploadQueue.actions.addMoreFiles')}
                </span>
              </FileUploader>

              <div className="flex flex-wrap gap-2">
                {hasPending ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void onStartUpload()}
                    disabled={isUploading}
                  >
                    {isUploading ? t('upload.progress.uploading') : t('upload.startUpload')}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void onReset()}
                  disabled={isUploading}
                >
                  {t('upload.reset')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <FileUploader
          onFilesSelected={onFilesSelected}
          disabled={isUploading}
          ariaLabel={t('tasks.uploadQueue.empty.action')}
          className="border-outline-variant/70 min-h-[28rem] justify-center rounded-xl border-dashed px-8 py-10"
        >
          <EmptyState
            icon={<CloudUpload className="size-7" />}
            title={t('tasks.uploadQueue.empty.title')}
            description={t('tasks.uploadQueue.empty.description')}
            action={
              <Button type="button" variant="outline" size="sm" disabled={isUploading}>
                <Plus className="size-4" />
                {t('tasks.uploadQueue.empty.action')}
              </Button>
            }
            className="max-w-none border-0 bg-transparent px-0 py-0"
          />
        </FileUploader>
      )}
    </section>
  )
}
