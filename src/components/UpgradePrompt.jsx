const TIER_NAMES = { starter: 'Starter', kitchen: 'Kitchen', performance: 'Performance' }

export default function UpgradePrompt({ feature, requiredTier, onUpgrade }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in">
      <div className="bg-navy-light rounded-2xl p-8 border border-gold/20 max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gold/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-cream mb-2">{feature}</h2>
        <p className="text-slate-400 mb-6">
          This feature is available on the <span className="text-gold font-semibold">{TIER_NAMES[requiredTier]}</span> plan and above.
          Upgrade to unlock it.
        </p>

        <button
          onClick={onUpgrade}
          className="w-full bg-gold hover:bg-gold-light text-navy font-semibold py-3 px-6 rounded-xl transition-colors cursor-pointer"
        >
          Upgrade to {TIER_NAMES[requiredTier]}
        </button>
      </div>
    </div>
  )
}
