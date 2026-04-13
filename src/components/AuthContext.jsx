import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('helix-token'))
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState(null)

  const logout = useCallback(() => {
    localStorage.removeItem('helix-token')
    setToken(null)
    setUser(null)
    setSubscription(null)
  }, [])

  const fetchUser = useCallback(async (t) => {
    try {
      const res = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!res.ok) {
        // Only logout on 401 (invalid/expired token), not transient errors
        if (res.status === 401) logout()
        return null
      }
      const data = await res.json()
      setUser(data.user)
      return data.user
    } catch {
      // Network error — don't logout, just return null
      return null
    }
  }, [logout])

  const fetchSubscription = useCallback(async (t) => {
    try {
      const res = await fetch('/api/subscription-status', {
        headers: { Authorization: `Bearer ${t || token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setSubscription(data)
    } catch { /* ignore */ }
  }, [token])

  useEffect(() => {
    if (token) {
      Promise.all([fetchUser(token), fetchSubscription(token)]).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email, password) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    localStorage.setItem('helix-token', data.token)
    setToken(data.token)

    // For admin users, set subscription from the login response directly
    // to avoid a race where user is set but subscription is still null,
    // which briefly shows the plan selection screen.
    if (data.user.subscriptionStatus === 'active' || data.user.subscriptionStatus === 'trialing') {
      setSubscription({
        status: data.user.subscriptionStatus,
        tier: data.user.tier,
        trialEnd: data.user.trialEnd || null,
        currentPeriodEnd: data.user.currentPeriodEnd || null,
        billingInterval: data.user.billingInterval || null,
        recipesGeneratedThisMonth: data.user.recipesGeneratedThisMonth || 0,
        recipeLimit: data.user.tier === 'starter' ? 20 : null,
      })
    }

    setUser(data.user)
    await fetchSubscription(data.token)
    return data.user
  }, [fetchSubscription])

  const register = useCallback(async (name, email, password) => {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Registration failed')
    localStorage.setItem('helix-token', data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const refreshUser = useCallback(async () => {
    if (token) {
      await fetchUser(token)
      await fetchSubscription(token)
    }
  }, [token, fetchUser, fetchSubscription])

  const authFetch = useCallback(async (url, options = {}) => {
    const headers = { ...options.headers, Authorization: `Bearer ${token}` }
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }
    return fetch(url, { ...options, headers })
  }, [token])

  const value = {
    user,
    token,
    loading,
    subscription,
    login,
    register,
    logout,
    refreshUser,
    authFetch,
    isSubscribed: user?.id === 'admin' || (subscription && (subscription.status === 'active' || subscription.status === 'trialing')),
    tier: user?.id === 'admin' ? 'performance' : (subscription?.tier || null),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
