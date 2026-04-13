import { useState } from 'react'
import HelixLogo from './HelixLogo'

export default function LoginPage({ onLogin, onSwitchToRegister, error: externalError }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await onLogin(email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <HelixLogo />
          </div>
          <h1 className="text-2xl font-bold text-cream mt-4">Welcome back</h1>
          <p className="text-slate-400 mt-1">Sign in to your Helix Kitchen account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-navy-light rounded-xl p-6 border border-navy-lighter/50 space-y-4">
          {(error || externalError) && (
            <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
              {error || externalError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-cream mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-navy border border-navy-lighter rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-cream mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-navy border border-navy-lighter rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold hover:bg-gold-light text-navy font-semibold py-3 px-6 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <p className="text-center text-sm text-slate-400">
            Don't have an account?{' '}
            <button type="button" onClick={onSwitchToRegister} className="text-gold hover:text-gold-light font-medium cursor-pointer">
              Create one
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
