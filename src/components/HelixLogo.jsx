export default function HelixLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* DNA helix icon */}
        <path
          d="M10 4C10 4 14 8 16 12C18 16 22 20 22 20"
          stroke="#C8952A"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M22 4C22 4 18 8 16 12C14 16 10 20 10 20"
          stroke="#C8952A"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M10 12C10 12 14 14 16 12C18 10 22 12 22 12"
          stroke="#C8952A"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path
          d="M22 28C22 28 18 24 16 20C14 16 10 12 10 12"
          stroke="#C8952A"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M10 28C10 28 14 24 16 20C18 16 22 12 22 12"
          stroke="#C8952A"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M10 20C10 20 14 22 16 20C18 18 22 20 22 20"
          stroke="#C8952A"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.6"
        />
      </svg>
      <span className="text-xl font-semibold tracking-tight">
        <span className="text-cream">Helix</span>{' '}
        <span className="text-gold">Kitchen</span>
      </span>
    </div>
  )
}
