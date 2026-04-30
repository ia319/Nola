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
  let currentState = state

  if (currentState.committedValue !== committedValue) {
    currentState = {
      committedValue,
      draftValue: committedValue,
    }
    setState(currentState)
  }

  const draftValue = currentState.draftValue
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
