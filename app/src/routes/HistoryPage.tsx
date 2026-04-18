import { HistoryPage as HistoryCenterPage } from '@/pages/history-center/HistoryPage'
import { normalizeHistorySearch } from './history-search'

/**
 * @deprecated Import HistoryPage from src/pages/history-center instead.
 * Keep this wrapper while legacy route imports are phased out.
 */
export function HistoryPage() {
  return <HistoryCenterPage search={normalizeHistorySearch({})} updateSearch={() => undefined} />
}
