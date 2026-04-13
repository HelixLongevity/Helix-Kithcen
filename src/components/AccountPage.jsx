import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'

const TIER_NAMES = { starter: 'Starter', kitchen: 'Kitchen', performance: 'Performance' }
const TIER_ORDER = ['starter', 'kitchen', 'performance']

function ChangeCheckoutForm({ tier, interval, authFetch, onSuccess, onCancel }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/subscription?action=change', {
        method: 'POST',
        body: JSON.stringify({ tier, interval }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">{error}</div>
      )}
      <p className="text-slate-300 text-sm">
        Change your plan to <span className="text-gold font-semibold">{TIER_NAMES[tier]}</span> ({interval === 'month' ? 'monthly' : 'annual'}).
        Your billing will be prorated.
      </p>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 px-4 rounded-xl border border-navy-lighter text-slate-400 hover:text-cream transition-colors cursor-pointer">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="flex-1 bg-gold hover:bg-gold-light text-navy font-semibold py-2.5 px-4 rounded-xl transition-colors cursor-pointer disabled:opacity-50">
          {loading ? 'Updating...' : 'Confirm Change'}
        </button>
      </div>
    </form>
  )
}

export default function AccountPage({ user, subscription, authFetch, onRefresh, onLogout }) {
  const [canceling, setCanceling] = useState(false)
  const [cancelError, setCancelError] = useState(null)
  const [showChange, setShowChange] = useState(null) // { tier, interval }
  const [stripePromise, setStripePromise] = useState(null)

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will retain access until the end of your current billing period.')) return
    setCanceling(true)
    setCancelError(null)
    try {
      const res = await authFetch('/api/subscription?action=cancel', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await onRefresh()
    } catch (err) {
      setCancelError(err.message)
    } finally {
      setCanceling(false)
    }
  }

  const handleShowChange = async (tier) => {
    if (!stripePromise) {
      const res = await fetch('/api/stripe-config')
      const { publishableKey } = await res.json()
      setStripePromise(loadStripe(publishableKey))
    }
    setShowChange({ tier, interval: subscription?.billingInterval || 'month' })
  }

  const formatDate = (iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const isTrialing = subscription?.status === 'trialing'
  const isCanceling = subscription?.status === 'canceling'
  const currentTier = subscription?.tier
  const currentTierIndex = TIER_ORDER.indexOf(currentTier)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-cream">Account</h1>
        <p className="text-slate-400 mt-1">Manage your subscription and usage</p>
      </div>

      {/* User info */}
      <div className="bg-navy-light rounded-xl p-6 border border-navy-lighter/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-cream">{user?.name}</h3>
            <p className="text-sm text-slate-400">{user?.email}</p>
          </div>
          <button
            onClick={onLogout}
            className="text-sm text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
        <p className="text-xs text-slate-500 opacity-60 mt-3">
          By using Helix Kitchen you agree that all recipes and nutritional information are AI-generated estimates and do not constitute medical or dietary advice.
        </p>
      </div>

      {/* Current plan */}
      <div className="bg-navy-light rounded-xl p-6 border border-navy-lighter/50">
        <h3 className="text-lg font-semibold text-gold mb-4">Current Plan</h3>

        {currentTier ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-cream">{TIER_NAMES[currentTier]}</span>
              {isTrialing && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gold/15 text-gold border border-gold/25">
                  Free Trial
                </span>
              )}
              {isCanceling && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-900/30 text-red-300 border border-red-700/40">
                  Canceling
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              {isTrialing && subscription?.trialEnd && (
                <div>
                  <p className="text-slate-500">Trial ends</p>
                  <p className="text-cream font-medium">{formatDate(subscription.trialEnd)}</p>
                </div>
              )}
              {subscription?.currentPeriodEnd && (
                <div>
                  <p className="text-slate-500">{isCanceling ? 'Access until' : 'Next billing date'}</p>
                  <p className="text-cream font-medium">{formatDate(subscription.currentPeriodEnd)}</p>
                </div>
              )}
              <div>
                <p className="text-slate-500">Billing</p>
                <p className="text-cream font-medium capitalize">{subscription?.billingInterval || '—'}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-slate-400">No active subscription</p>
        )}
      </div>

      {/* Usage */}
      {currentTier && (
        <div className="bg-navy-light rounded-xl p-6 border border-navy-lighter/50">
          <h3 className="text-lg font-semibold text-gold mb-4">Usage This Month</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm text-slate-400">Recipes generated</span>
                <span className="text-cream font-medium">
                  {subscription?.recipesGeneratedThisMonth || 0}
                  {subscription?.recipeLimit ? ` / ${subscription.recipeLimit}` : ''}
                </span>
              </div>
              {subscription?.recipeLimit && (
                <div className="w-full bg-navy rounded-full h-2">
                  <div
                    className="bg-gold rounded-full h-2 transition-all"
                    style={{ width: `${Math.min(100, ((subscription.recipesGeneratedThisMonth || 0) / subscription.recipeLimit) * 100)}%` }}
                  />
                </div>
              )}
              {!subscription?.recipeLimit && (
                <p className="text-xs text-slate-500">Unlimited recipes on your plan</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upgrade/downgrade */}
      {currentTier && !isCanceling && (
        <div className="bg-navy-light rounded-xl p-6 border border-navy-lighter/50">
          <h3 className="text-lg font-semibold text-gold mb-4">Change Plan</h3>
          <div className="space-y-3">
            {TIER_ORDER.filter(t => t !== currentTier).map((tier) => {
              const tierIndex = TIER_ORDER.indexOf(tier)
              const isUpgrade = tierIndex > currentTierIndex
              return (
                <button
                  key={tier}
                  onClick={() => handleShowChange(tier)}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-navy-lighter hover:border-gold/30 transition-colors cursor-pointer"
                >
                  <span className="text-cream font-medium">{TIER_NAMES[tier]}</span>
                  <span className={`text-sm font-medium ${isUpgrade ? 'text-gold' : 'text-slate-400'}`}>
                    {isUpgrade ? 'Upgrade' : 'Downgrade'}
                  </span>
                </button>
              )
            })}
          </div>

          {showChange && stripePromise && (
            <div className="mt-4 p-4 bg-navy rounded-xl border border-gold/20">
              <Elements stripe={stripePromise}>
                <ChangeCheckoutForm
                  tier={showChange.tier}
                  interval={showChange.interval}
                  authFetch={authFetch}
                  onSuccess={() => { setShowChange(null); onRefresh() }}
                  onCancel={() => setShowChange(null)}
                />
              </Elements>
            </div>
          )}
        </div>
      )}

      {/* Cancel */}
      {currentTier && !isCanceling && (
        <div className="bg-navy-light rounded-xl p-6 border border-navy-lighter/50">
          {cancelError && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">{cancelError}</div>
          )}
          <button
            onClick={handleCancel}
            disabled={canceling}
            className="text-sm text-slate-500 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
          >
            {canceling ? 'Canceling...' : 'Cancel subscription'}
          </button>
          <p className="text-xs text-slate-600 mt-1">You'll retain access until the end of your current billing period</p>
        </div>
      )}
    </div>
  )
}
