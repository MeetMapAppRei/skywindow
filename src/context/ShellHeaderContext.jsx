import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

const ShellHeaderContext = createContext(null)

/* eslint-disable react/prop-types -- children-only provider */
export function ShellHeaderProvider({ children }) {
  const [rightAction, setRightAction] = useState(null)

  const setHeaderAction = useCallback((node) => {
    setRightAction(node)
  }, [])

  const value = useMemo(
    () => ({
      rightAction,
      setHeaderAction,
    }),
    [rightAction, setHeaderAction],
  )

  return (
    <ShellHeaderContext.Provider value={value}>
      {children}
    </ShellHeaderContext.Provider>
  )
}

export function useShellHeader() {
  const ctx = useContext(ShellHeaderContext)
  if (!ctx) {
    throw new Error('useShellHeader must be used within AppShell')
  }
  return ctx
}
