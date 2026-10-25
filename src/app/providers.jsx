'use client'
import { useEffect } from 'react'
import { Provider, useDispatch } from 'react-redux'
import { store } from '@/store/store'
import { supabase } from '@/lib/supabaseClient'
import { setSessionUser, setAuthReady, clearAuth } from '@/store/features/authSlice'
import { ThemeProvider } from '@/components/theme/ThemeProvider'

function AuthListener() {
  const dispatch = useDispatch()
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      dispatch(setSessionUser(session?.user || null))
      dispatch(setAuthReady(true))
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      dispatch(setSessionUser(session?.user || null))
      dispatch(setAuthReady(true))
      if (!session) dispatch(clearAuth())
    })
    return () => subscription.unsubscribe()
  }, [dispatch])
  return null
}

export function Providers({ children }) {
  return (
    <ThemeProvider>
      <Provider store={store}>
        <AuthListener />
        {children}
      </Provider>
    </ThemeProvider>
  )
}
