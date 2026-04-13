import { useState } from 'react'
import { useAuth } from './AuthContext'

const FEEDBACK_TYPES = ['Bug Report', 'Feature Suggestion', 'General Feedback', 'Improvement']
const APP_SECTIONS = ['Recipes', 'Favourites', 'Meal Planner', 'Macro Targets', 'Dish Request', 'Account', 'General']

export default function FeedbackModal({ onClose }) {
  const { user, subscription, authFetch } = useAuth()
  const [type, setType] = useState('General Feedback')
  const [section, setSection] = useState('General')
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const isValid = feedback.trim().length >= 10

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await authFetch('/api/me', {
        method: 'POST',
        body: JSON.stringify({
          action: 'feedback',
          type,
          section,
          feedback: feedback.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to submit feedback')
      }
      setSuccess(true)
      setTimeout(() => onClose(), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-navy-light rounded-2xl border border-gold/20 w-full max-w-md animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-cream">Send Feedback</h2>
            <button
              onClick={onClose}
              className="text-cream-dark/50 hover:text-cream transition-colors cursor-pointer text-xl leading-none"
            >
              &times;
            </button>
          </div>

          {success ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-3">&#10003;</div>
              <p className="text-cream font-medium">Thanks for your feedback!</p>
              <p className="text-slate-400 text-sm mt-1">We'll review it shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-cream-dark mb-1.5">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-navy border border-navy-lighter/60 rounded-xl px-3 py-2.5 text-cream text-sm focus:outline-none focus:border-gold/50"
                >
                  {FEEDBACK_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-cream-dark mb-1.5">App Section</label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full bg-navy border border-navy-lighter/60 rounded-xl px-3 py-2.5 text-cream text-sm focus:outline-none focus:border-gold/50"
                >
                  {APP_SECTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-cream-dark mb-1.5">
                  Feedback <span className="text-slate-500 font-normal">(min 10 characters)</span>
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={4}
                  placeholder="Tell us what's on your mind..."
                  className="w-full bg-navy border border-navy-lighter/60 rounded-xl px-3 py-2.5 text-cream text-sm focus:outline-none focus:border-gold/50 resize-none placeholder:text-slate-500"
                />
                {feedback.length > 0 && feedback.trim().length < 10 && (
                  <p className="text-red-400 text-xs mt-1">
                    {10 - feedback.trim().length} more characters needed
                  </p>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500">
                  Submitting as {user?.name || user?.email}
                </span>
                <button
                  type="submit"
                  disabled={!isValid || submitting}
                  className="bg-gold hover:bg-gold-light disabled:opacity-40 disabled:cursor-not-allowed text-navy font-semibold py-2.5 px-6 rounded-xl transition-colors cursor-pointer text-sm"
                >
                  {submitting ? 'Sending...' : 'Submit'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
