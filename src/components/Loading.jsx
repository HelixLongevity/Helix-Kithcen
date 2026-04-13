export default function Loading({ message, submessage }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      {/* Spinning helix */}
      <div className="relative w-16 h-16">
        <svg
          className="animate-spin-slow w-16 h-16"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="32" cy="32" r="28" stroke="#1A2D4A" strokeWidth="3" />
          <path
            d="M32 4a28 28 0 0 1 28 28"
            stroke="#C8952A"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-cream text-lg font-medium mb-1">{message || 'Chef Marco is crafting your recipe...'}</p>
        <p className="text-slate-500 text-sm">{submessage || 'This usually takes 10–20 seconds'}</p>
      </div>
    </div>
  )
}
