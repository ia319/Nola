import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { ExportFormat } from '@/shared/types'
import type { SingleExportTarget } from '../api'

const EXPORT_FORMATS: ExportFormat[] = ['srt', 'vtt', 'txt', 'ass']

export interface ExportDialogValue {
  format: ExportFormat
  includeTimestamps: boolean
  target: SingleExportTarget
  filename: string
  zipName: string
  saveAsDefault: boolean
}

export interface ExportDialogProps {
  open: boolean
  mode: 'single' | 'batch'
  taskCount: number
  defaultFilename?: string
  value: ExportDialogValue
  isLoadingDefaults?: boolean
  isSubmitting?: boolean
  isUpdatingDefaults?: boolean
  onChange: (next: ExportDialogValue) => void
  onConfirm: () => void
  onCancel: () => void
  onResetDefaults: () => void
}

/**
 * Collect export parameters in one place so single and batch flows share the same contract.
 */
export function ExportDialog({
  open,
  mode,
  taskCount,
  defaultFilename,
  value,
  isLoadingDefaults = false,
  isSubmitting = false,
  isUpdatingDefaults = false,
  onChange,
  onConfirm,
  onCancel,
  onResetDefaults,
}: ExportDialogProps) {
  const { t } = useTranslation()

  const title = useMemo(() => {
    if (mode === 'single') {
      return t('tasks.exportDialog.titleSingle')
    }
    return t('tasks.exportDialog.titleBatch', { count: taskCount })
  }, [mode, taskCount, t])

  if (!open) {
    return null
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onCancel()
        }
      }}
    >
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === 'single'
              ? t('tasks.exportDialog.descriptionSingle')
              : t('tasks.exportDialog.descriptionBatch')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="export-format">{t('tasks.exportDialog.fields.format')}</Label>
            <Select
              value={value.format}
              onValueChange={(next) => {
                onChange({
                  ...value,
                  format: next as ExportFormat,
                })
              }}
            >
              <SelectTrigger id="export-format" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPORT_FORMATS.map((format) => (
                  <SelectItem key={format} value={format}>
                    {format.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === 'single' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="export-target">{t('tasks.exportDialog.fields.target')}</Label>
                <Select
                  value={value.target}
                  onValueChange={(next) => {
                    onChange({
                      ...value,
                      target: next as SingleExportTarget,
                    })
                  }}
                >
                  <SelectTrigger id="export-target" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="download">
                      {t('tasks.exportDialog.target.download')}
                    </SelectItem>
                    <SelectItem value="save">{t('tasks.exportDialog.target.save')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="export-filename">{t('tasks.exportDialog.fields.filename')}</Label>
                <Input
                  id="export-filename"
                  value={value.filename}
                  placeholder={t('tasks.exportDialog.fields.filenamePlaceholder')}
                  onChange={(event) => {
                    onChange({
                      ...value,
                      filename: event.target.value,
                    })
                  }}
                />
                {defaultFilename ? (
                  <p className="text-muted-foreground text-xs">
                    {t('tasks.exportDialog.fields.defaultFilenameHint', {
                      filename: defaultFilename,
                    })}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="export-include-timestamps">
                {t('tasks.exportDialog.fields.includeTimestamps')}
              </Label>
              <Switch
                id="export-include-timestamps"
                checked={value.includeTimestamps}
                disabled={value.format !== 'txt'}
                onCheckedChange={(checked) => {
                  onChange({
                    ...value,
                    includeTimestamps: checked,
                  })
                }}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              {t('tasks.exportDialog.fields.includeHint')}
            </p>
          </div>

          {mode === 'batch' ? (
            <div className="space-y-2">
              <Label htmlFor="export-zip-name">{t('tasks.exportDialog.fields.zipName')}</Label>
              <Input
                id="export-zip-name"
                value={value.zipName}
                placeholder={t('tasks.exportDialog.fields.zipNamePlaceholder')}
                onChange={(event) => {
                  onChange({
                    ...value,
                    zipName: event.target.value,
                  })
                }}
              />
              <p className="text-muted-foreground text-xs">
                {t('tasks.exportDialog.fields.zipNameHint')}
              </p>
            </div>
          ) : null}

          <div className="space-y-2 rounded-md border border-dashed p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.saveAsDefault}
                onChange={(event) => {
                  onChange({
                    ...value,
                    saveAsDefault: event.target.checked,
                  })
                }}
              />
              {t('tasks.exportDialog.actions.saveAsDefault')}
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isUpdatingDefaults}
              onClick={onResetDefaults}
            >
              {isUpdatingDefaults
                ? t('tasks.exportDialog.actions.resettingDefaults')
                : t('tasks.exportDialog.actions.resetDefaults')}
            </Button>
            {isLoadingDefaults ? (
              <p className="text-muted-foreground text-xs">
                {t('tasks.exportDialog.loadingDefaults')}
              </p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              {t('tasks.exportDialog.actions.cancel')}
            </Button>
            <Button type="button" onClick={onConfirm} disabled={isSubmitting}>
              {isSubmitting
                ? t('tasks.exportDialog.actions.confirming')
                : t('tasks.exportDialog.actions.confirm')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
