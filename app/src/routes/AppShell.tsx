import { AppShell as ShellAppShell } from '@/shell/AppShell'

/**
 * @deprecated Import AppShell from src/shell instead.
 * Keep this wrapper while legacy route imports are phased out.
 */
export function AppShell() {
  return <ShellAppShell />
}
