import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import HelixLogo from './HelixLogo'

const TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 9.99,
    yearlyPrice: 99.99,
    features: [
      'AI recipe generation',
      'Save favourites',
      '20 recipes per month',
    ],
    cta: 'Start 7-day free trial',
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    monthlyPrice: 19.99,
    yearlyPrice: 199.99,
    popular: true,
    features: [
      'Everything in Starter',
      'Unlimited recipes',
      'Meal Planner',
      'Shopping list generator',
    ],
    cta: 'Start 7-day free trial',
  },
  {
    id: 'performance',
    name: 'Performance',
    monthlyPrice: 29.99,
    yearlyPrice: 299.99,
    features: [
      'Everything in Kitchen',
      'Macro Targets feature',
      'Precision nutrition engineering',
      'Dish Request — describe any dish and Chef Marco creates the perfect recipe',
    ],
    cta: 'Start 7-day free trial',
  },
]

function CheckoutForm({ tier, interval, onSuccess, onCancel, authFetch }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError(null)

    try {
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement),
      })

      if (pmError) {
        setError(pmError.message)
        setLoading(false)
        return
      }

      const res = await authFetch('/api/subscription?action=create', {
        method: 'POST',
        body: JSON.stringify({
          tier: tier.id,
          interval,
          paymentMethodId: paymentMethod.id,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create subscription')
        setLoading(false)
        return
      }

      onSuccess()
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const price = interval === 'month' ? tier.monthlyPrice : tier.yearlyPrice

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-navy-light rounded-2xl p-8 border border-navy-lighter/50 max-w-md w-full">
        <h3 className="text-xl font-bold text-cream mb-1">Subscribe to {tier.name}</h3>
        <p className="text-slate-400 text-sm mb-6">
          ${price.toFixed(2)} AUD/{interval === 'month' ? 'month' : 'year'} — 7-day free trial
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-cream mb-2">Card details</label>
            <div className="bg-navy border border-navy-lighter rounded-lg px-4 py-3">
              <CardElement
                options={{
                  hidePostalCode: true,
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#E2E8F0',
                      '::placeholder': { color: '#64748b' },
                    },
                    invalid: { color: '#ef4444' },
                  },
                }}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 px-4 rounded-xl border border-navy-lighter text-slate-400 hover:text-cream transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !stripe}
              className="flex-1 bg-gold hover:bg-gold-light text-navy font-semibold py-3 px-4 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Start Free Trial'}
            </button>
          </div>

          <p className="text-xs text-slate-500 text-center">
            Your card won't be charged during the 7-day trial. Cancel anytime.
          </p>
        </form>
      </div>
    </div>
  )
}

export default function PricingPage({ onLogin, onRegister, isLoggedIn, authFetch, onSubscribed, onShowLogin }) {
  const [isAnnual, setIsAnnual] = useState(false)
  const [showAuth, setShowAuth] = useState(null) // 'login' | 'register'
  const [selectedTier, setSelectedTier] = useState(null)
  const [stripePromise, setStripePromise] = useState(null)

  // Auth form states
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authConfirm, setAuthConfirm] = useState('')
  const [authError, setAuthError] = useState(null)
  const [authLoading, setAuthLoading] = useState(false)

  const handleSelectTier = async (tier) => {
    if (!isLoggedIn) {
      setSelectedTier(tier)
      setShowAuth('register')
      return
    }
    // Already logged in — show checkout
    if (!stripePromise) {
      const res = await fetch('/api/stripe-config')
      const { publishableKey } = await res.json()
      setStripePromise(loadStripe(publishableKey))
    }
    setSelectedTier(tier)
  }

  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    setAuthError(null)
    setAuthLoading(true)

    try {
      if (showAuth === 'register') {
        if (authPassword !== authConfirm) {
          setAuthError('Passwords do not match')
          setAuthLoading(false)
          return
        }
        await onRegister(authName, authEmail, authPassword)
      } else {
        await onLogin(authEmail, authPassword)
      }

      // After auth, show checkout
      if (!stripePromise) {
        const res = await fetch('/api/stripe-config')
        const { publishableKey } = await res.json()
        setStripePromise(loadStripe(publishableKey))
      }
      setShowAuth(null)
    } catch (err) {
      setAuthError(err.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSubscribed = () => {
    setSelectedTier(null)
    if (onSubscribed) onSubscribed()
  }

  return (
    <div className="min-h-screen bg-navy">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gold/5 via-transparent to-transparent" />
        <div className="max-w-5xl mx-auto px-4 pt-12 pb-8 relative">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <HelixLogo />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-cream mb-4 leading-tight">
              Restaurant-quality meals,<br />
              <span className="text-gold">engineered for your health</span>
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-4">
              Chef Marco combines Michelin-level culinary expertise with precision nutrition
              science to create meals that taste incredible and fuel your body.
            </p>
            <p className="text-xs text-slate-500 opacity-60 max-w-2xl mx-auto mb-8 leading-relaxed">
              Helix Kitchen is powered by artificial intelligence. Chef Marco is an AI assistant, not a real Michelin-star chef. Recipes are AI-generated and should be used as inspiration only. Use of this app does not constitute medical or nutritional advice. Please consult a qualified medical practitioner or dietitian for personalised health and nutrition guidance.
            </p>

            {!isLoggedIn && (
              <div className="flex justify-center gap-3 mb-8">
                <button
                  onClick={() => { setShowAuth('login'); setSelectedTier(null) }}
                  className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-navy-lighter hover:text-cream hover:border-gold/30 transition-colors cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pricing toggle */}
      <div className="max-w-5xl mx-auto px-4 mb-8">
        <div className="flex items-center justify-center gap-3">
          <div className="inline-flex rounded-full border border-navy-lighter bg-navy-light p-1">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                !isAnnual
                  ? 'bg-gold text-navy-dark shadow-sm'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                isAnnual
                  ? 'bg-gold text-navy-dark shadow-sm'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Annual
            </button>
          </div>
          {isAnnual && (
            <span className="text-xs font-semibold text-navy bg-gold px-2 py-0.5 rounded-full">
              Save 17%
            </span>
          )}
        </div>

        <p className="text-center text-sm mt-4 mb-6 text-gray-400">Already have an account? <span onClick={onShowLogin} className="text-gold cursor-pointer hover:underline font-semibold">Sign in</span></p>
      </div>

      {/* Tier cards */}
      <div className="max-w-5xl mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-3 gap-6">
          {TIERS.map((tier) => {
            const displayPrice = isAnnual
              ? (tier.yearlyPrice / 12).toFixed(2)
              : tier.monthlyPrice.toFixed(2)

            return (
              <div
                key={tier.id}
                className={`relative bg-navy-light rounded-2xl p-8 border transition-all ${
                  tier.popular
                    ? 'border-gold/50 shadow-lg shadow-gold/10 scale-[1.02]'
                    : 'border-navy-lighter/50 hover:border-navy-lighter'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gold text-navy text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-bold text-cream mb-2">{tier.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-cream">${displayPrice}</span>
                    <span className="text-slate-400 text-sm">/month</span>
                  </div>
                  {isAnnual && (
                    <p className="text-xs text-gold mt-1">
                      ${tier.yearlyPrice.toFixed(2)} billed annually
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">AUD — all prices include GST</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <svg className="w-5 h-5 text-gold shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectTier(tier)}
                  className={`w-full py-3 px-6 rounded-xl font-semibold text-sm transition-colors cursor-pointer ${
                    tier.popular
                      ? 'bg-gold hover:bg-gold-light text-navy shadow-lg shadow-gold/10'
                      : 'bg-navy border border-gold/30 text-gold hover:bg-gold/10'
                  }`}
                >
                  {tier.cta}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Auth modal */}
      {showAuth && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-navy-light rounded-2xl p-8 border border-navy-lighter/50 max-w-md w-full">
            <h3 className="text-xl font-bold text-cream mb-1">
              {showAuth === 'register' ? 'Create your account' : 'Sign in'}
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              {selectedTier
                ? `to start your ${selectedTier.name} free trial`
                : 'to access Helix Kitchen'}
            </p>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authError && (
                <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
                  {authError}
                </div>
              )}

              {showAuth === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-cream mb-1.5">Name</label>
                  <input
                    type="text"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    required
                    className="w-full bg-navy border border-navy-lighter rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/50"
                    placeholder="Your name"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-cream mb-1.5">Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required
                  className="w-full bg-navy border border-navy-lighter rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/50"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-cream mb-1.5">Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                  className="w-full bg-navy border border-navy-lighter rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/50"
                  placeholder="At least 6 characters"
                />
              </div>

              {showAuth === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-cream mb-1.5">Confirm Password</label>
                  <input
                    type="password"
                    value={authConfirm}
                    onChange={(e) => setAuthConfirm(e.target.value)}
                    required
                    className="w-full bg-navy border border-navy-lighter rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/50"
                    placeholder="••••••••"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAuth(null); setAuthError(null) }}
                  className="flex-1 py-3 px-4 rounded-xl border border-navy-lighter text-slate-400 hover:text-cream transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="flex-1 bg-gold hover:bg-gold-light text-navy font-semibold py-3 px-4 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {authLoading ? 'Please wait...' : showAuth === 'register' ? 'Create Account' : 'Sign In'}
                </button>
              </div>

              <p className="text-center text-sm text-slate-400">
                {showAuth === 'register' ? (
                  <>Already have an account?{' '}
                    <button type="button" onClick={() => { setShowAuth('login'); setAuthError(null) }} className="text-gold hover:text-gold-light font-medium cursor-pointer">Sign in</button>
                  </>
                ) : (
                  <>Don't have an account?{' '}
                    <button type="button" onClick={() => { setShowAuth('register'); setAuthError(null) }} className="text-gold hover:text-gold-light font-medium cursor-pointer">Create one</button>
                  </>
                )}
              </p>
            </form>
          </div>
        </div>
      )}

      {/* Stripe checkout modal */}
      {selectedTier && isLoggedIn && stripePromise && !showAuth && (
        <Elements stripe={stripePromise}>
          <CheckoutForm
            tier={selectedTier}
            interval={isAnnual ? 'year' : 'month'}
            authFetch={authFetch}
            onSuccess={handleSubscribed}
            onCancel={() => setSelectedTier(null)}
          />
        </Elements>
      )}

      {/* Footer */}
      <footer className="border-t border-navy-lighter/30">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center text-slate-500 text-xs opacity-60 leading-relaxed">
          Chef Marco is an AI-powered culinary assistant. Recipes and nutritional information are AI-generated estimates only. Use of this app does not constitute medical advice. Consult a qualified medical practitioner or dietitian for personalised guidance. &middot; Helix Longevity
        </div>
      </footer>
    </div>
  )
}
