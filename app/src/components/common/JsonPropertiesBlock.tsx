import { AlertCircle } from 'lucide-react'

import { EmptyState } from '@/components/ui/EmptyState'

export interface JsonPropertiesBlockProps {
  value: Record<string, unknown> | null | undefined
  title: string
  emptyTitle: string
  emptyDescription: string
}

function hasDisplayableProperties(
  value: Record<string, unknown> | null | undefined,
): value is Record<string, unknown> {
  return Boolean(value && Object.keys(value).length > 0)
}

function formatJson(value: Record<string, unknown>): string | null {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return null
  }
}

export function JsonPropertiesBlock({
  value,
  title,
  emptyTitle,
  emptyDescription,
}: JsonPropertiesBlockProps) {
  const json = hasDisplayableProperties(value) ? formatJson(value) : null

  return (
    <div className="space-y-3">
      <h4 className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
        {title}
      </h4>

      {json ? (
        <pre className="bg-background/80 text-foreground max-h-72 overflow-auto rounded-md border px-3 py-3 text-xs leading-5 whitespace-pre-wrap">
          <code>{json}</code>
        </pre>
      ) : (
        <EmptyState
          icon={<AlertCircle className="size-6" />}
          title={emptyTitle}
          description={emptyDescription}
        />
      )}
    </div>
  )
}
