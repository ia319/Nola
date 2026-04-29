import { useCallback, useState } from 'react'

interface SearchDraftState {
  committedValue: string
  draftValue: string
}

export function useHistorySearchDraft(committedValue: string) {
  const [state, setState] = useState<SearchDraftState>(() => ({
    committedValue,
    draftValue: committedValue,
  }))
  const draftValue = state.committedValue === committedValue ? state.draftValue : committedValue
  const setDraftValue = useCallback(
    (nextDraftValue: string) => {
      setState({
        committedValue,
        draftValue: nextDraftValue,
      })
    },
    [committedValue],
  )

  return [draftValue, setDraftValue] as const
}
