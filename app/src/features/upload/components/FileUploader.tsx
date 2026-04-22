import type { ReactNode } from 'react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ALLOWED_EXTENSIONS } from '@/config/constants'
import { cn } from '@/lib/utils'

export interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
  className?: string
  ariaLabel?: string
  children?: ReactNode
}

const ACCEPT = ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',')

/**
 * Drag-and-drop / click-to-browse file selector for multi-file upload.
 *
 * Passes raw File[] to the parent without performing validation itself;
 * validation is handled by the useFileUpload hook's addFiles method.
 */
export function FileUploader({
  onFilesSelected,
  disabled = false,
  className,
  ariaLabel,
  children,
}: FileUploaderProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return
      onFilesSelected(Array.from(fileList))
      // Reset input so selecting the same file again triggers onChange
      if (inputRef.current) inputRef.current.value = ''
    },
    [onFilesSelected],
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!disabled) setIsDragOver(true)
    },
    [disabled],
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      if (!disabled) handleFiles(e.dataTransfer.files)
    },
    [disabled, handleFiles],
  )

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click()
  }, [disabled])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleClick()
      }
    },
    [handleClick],
  )

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel ?? t('upload.dropzone.title')}
      aria-disabled={disabled}
      className={cn(
        'focus-visible:ring-ring flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-8 transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none',
        isDragOver
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50',
        disabled && 'pointer-events-none cursor-not-allowed opacity-50',
        className,
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {children ?? (
        <>
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <Upload className="text-muted-foreground size-6" />
          </div>

          <div className="text-center">
            <p className="text-sm font-medium">{t('upload.dropzone.title')}</p>
            <p className="text-muted-foreground mt-1 text-xs">{t('upload.dropzone.description')}</p>
          </div>

          <Button type="button" variant="outline" size="sm" disabled={disabled}>
            {t('upload.dropzone.browse')}
          </Button>

          <p className="text-muted-foreground/70 text-xs">{t('upload.dropzone.hint')}</p>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />
    </div>
  )
}
