import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from '../lib/supabase.js'

const AuthContext = createContext(null)

/* eslint-disable-next-line react/prop-types -- children-only provider */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    let cancelled = false

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return
        setUser(session?.user ?? null)
        setAuthError('')
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setUser(null)
        setAuthError(err?.message ?? 'Could not restore your session.')
        setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthError('')
      setLoading(false)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(() => supabase.auth.signOut(), [])

  const value = useMemo(
    () => ({
      user,
      loading,
      authError,
      signOut,
    }),
    [user, loading, authError, signOut],
  )

  return createElement(AuthContext.Provider, { value }, children)
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
