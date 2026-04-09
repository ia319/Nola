import { HistoryPage as HistoryCenterPage } from '@/pages/history-center/HistoryPage'

/**
 * @deprecated Import HistoryPage from src/pages/history-center instead.
 * Keep this wrapper while legacy route imports are phased out.
 */
export function HistoryPage() {
  return <HistoryCenterPage />
}
