import { ModelsPage as ModelsManagementPage } from '@/pages/models-management/ModelsPage'

/**
 * @deprecated Import ModelsPage from src/pages/models-management instead.
 * Keep this wrapper while legacy route imports are phased out.
 */
export function ModelsPage() {
  return <ModelsManagementPage />
}
