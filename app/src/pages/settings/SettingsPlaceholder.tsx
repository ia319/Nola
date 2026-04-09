type SettingsPlaceholderProps = {
  title: string
  description: string
}

export function SettingsPlaceholder({ title, description }: SettingsPlaceholderProps) {
  return (
    <section
      data-slot="settings-placeholder"
      className="bg-card border-border rounded-xl border p-6 shadow-sm"
    >
      <div className="space-y-2">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground text-sm leading-6">{description}</p>
      </div>
    </section>
  )
}
