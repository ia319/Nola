import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  AudioLines,
  BellDot,
  BrainCircuit,
  CheckCircle2,
  CircleHelp,
  CircleX,
  Download,
  Filter,
  FolderOpen,
  History,
  ListTodo,
  LoaderCircle,
  MoreHorizontal,
  Play,
  Search,
  Settings2,
  SunMoon,
  Upload,
} from 'lucide-react'

export type AppIconName =
  | 'logo'
  | 'tasks'
  | 'history'
  | 'models'
  | 'settings'
  | 'activity'
  | 'theme'
  | 'help'
  | 'search'
  | 'filter'
  | 'upload'
  | 'download'
  | 'run'
  | 'details'
  | 'folder'
  | 'success'
  | 'warning'
  | 'error'
  | 'loading'

// Keep icon choices centralized so page implementations stay on one icon system
// instead of reintroducing mixed icon sets from design exports.
export const appIcons: Record<AppIconName, LucideIcon> = {
  logo: AudioLines,
  tasks: ListTodo,
  history: History,
  models: BrainCircuit,
  settings: Settings2,
  activity: BellDot,
  theme: SunMoon,
  help: CircleHelp,
  search: Search,
  filter: Filter,
  upload: Upload,
  download: Download,
  run: Play,
  details: MoreHorizontal,
  folder: FolderOpen,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: CircleX,
  loading: LoaderCircle,
}
