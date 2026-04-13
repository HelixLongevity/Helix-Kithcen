import { useEffect } from 'react'

export default function PrintView({ recipe, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 300)
    const handleAfterPrint = () => onClose()
    window.addEventListener('afterprint', handleAfterPrint)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [onClose])

  const formatTime = (seconds) => {
    if (!seconds) return null
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs ? `${mins}m ${secs}s` : `${mins} min`
  }

  return (
    <div className="print-view fixed inset-0 z-50 bg-white overflow-auto">
      {/* Close button (hidden in print) */}
      <button
        onClick={onClose}
        className="no-print fixed top-4 right-4 z-50 bg-navy text-cream px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-navy-light"
      >
        ✕ Close
      </button>

      <div className="max-w-2xl mx-auto px-8 py-10 text-black">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 pb-4 border-b-2 border-gray-200">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 4C10 4 14 8 16 12C18 16 22 20 22 20" stroke="#0A1628" strokeWidth="2" strokeLinecap="round" />
            <path d="M22 4C22 4 18 8 16 12C14 16 10 20 10 20" stroke="#0A1628" strokeWidth="2" strokeLinecap="round" />
            <path d="M10 12C10 12 14 14 16 12C18 10 22 12 22 12" stroke="#0A1628" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
            <path d="M22 28C22 28 18 24 16 20C14 16 10 12 10 12" stroke="#0A1628" strokeWidth="2" strokeLinecap="round" />
            <path d="M10 28C10 28 14 24 16 20C18 16 22 12 22 12" stroke="#0A1628" strokeWidth="2" strokeLinecap="round" />
            <path d="M10 20C10 20 14 22 16 20C18 18 22 20 22 20" stroke="#0A1628" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
          </svg>
          <span style={{ fontSize: '20px', fontWeight: 600 }}>
            Helix Kitchen
          </span>
        </div>

        {/* Title */}
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>{recipe.title}</h1>
        <p style={{ color: '#666', fontSize: '16px', marginBottom: '16px' }}>{recipe.description}</p>

        {/* Prep/Cook time & Difficulty */}
        {(recipe.prep_time_minutes || recipe.cooking_time_minutes || recipe.difficulty) && (
          <p style={{ fontSize: '13px', marginBottom: '16px', color: '#555' }}>
            {recipe.prep_time_minutes != null && <span><strong>Prep:</strong> {recipe.prep_time_minutes} min</span>}
            {recipe.prep_time_minutes != null && recipe.cooking_time_minutes != null && <span> &nbsp;|&nbsp; </span>}
            {recipe.cooking_time_minutes != null && <span><strong>Cook:</strong> {recipe.cooking_time_minutes} min</span>}
            {(recipe.prep_time_minutes || recipe.cooking_time_minutes) && recipe.difficulty && <span> &nbsp;|&nbsp; </span>}
            {recipe.difficulty && <span><strong>Difficulty:</strong> {recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}</span>}
          </p>
        )}

        {/* Allergens */}
        {recipe.allergens && recipe.allergens.length > 0 && (
          <p style={{ fontSize: '13px', marginBottom: '20px', color: '#888' }}>
            <strong>Allergens:</strong> {recipe.allergens.map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(', ')}
          </p>
        )}

        {/* Ingredients */}
        <h2 style={{ fontSize: '18px', fontWeight: 600, borderBottom: '1px solid #ddd', paddingBottom: '6px', marginBottom: '12px' }}>Ingredients</h2>
        <ul style={{ listStyle: 'disc', paddingLeft: '20px', marginBottom: '28px' }}>
          {recipe.ingredients.map((ing, i) => (
            <li key={i} style={{ marginBottom: '4px', fontSize: '14px' }}>
              {ing.amount && <strong>{ing.amount}{ing.unit ? ` ${ing.unit}` : ''}</strong>}{' '}
              {ing.name}
            </li>
          ))}
        </ul>

        {/* Steps */}
        <h2 style={{ fontSize: '18px', fontWeight: 600, borderBottom: '1px solid #ddd', paddingBottom: '6px', marginBottom: '12px' }}>Method</h2>
        <ol style={{ paddingLeft: '20px', marginBottom: '28px' }}>
          {recipe.steps.map((step, i) => (
            <li key={i} style={{ marginBottom: '12px', fontSize: '14px' }}>
              {step.title && <strong>{step.title}: </strong>}
              {step.instruction}
              {step.timer_seconds > 0 && (
                <span style={{ color: '#888', fontSize: '12px' }}> ({formatTime(step.timer_seconds)})</span>
              )}
            </li>
          ))}
        </ol>

        {/* Tips */}
        {recipe.tips && recipe.tips.length > 0 && (
          <>
            <h2 style={{ fontSize: '18px', fontWeight: 600, borderBottom: '1px solid #ddd', paddingBottom: '6px', marginBottom: '12px' }}>Chef Marco's Tips</h2>
            <ul style={{ listStyle: 'none', paddingLeft: '0', marginBottom: '28px' }}>
              {recipe.tips.map((tip, i) => (
                <li key={i} style={{ marginBottom: '6px', fontSize: '14px', paddingLeft: '16px', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0 }}>★</span>
                  {tip}
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Notes */}
        {recipe.notes && (
          <>
            <h2 style={{ fontSize: '18px', fontWeight: 600, borderBottom: '1px solid #ddd', paddingBottom: '6px', marginBottom: '12px' }}>Notes</h2>
            <p style={{ fontSize: '14px', marginBottom: '28px', color: '#444' }}>{recipe.notes}</p>
          </>
        )}

        {/* Nutrition */}
        {recipe.nutrition_per_serving && (
          <>
            <h2 style={{ fontSize: '18px', fontWeight: 600, borderBottom: '1px solid #ddd', paddingBottom: '6px', marginBottom: '12px' }}>Nutrition Per Serving</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '20px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #333' }}>
                  <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 600 }}>Nutrient</th>
                  <th style={{ textAlign: 'right', padding: '6px 0', fontWeight: 600 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Calories', recipe.nutrition_per_serving.calories, 'kcal'],
                  ['Protein', recipe.nutrition_per_serving.protein_g, 'g'],
                  ['Total Fat', recipe.nutrition_per_serving.total_fat_g, 'g'],
                  ['Saturated Fat', recipe.nutrition_per_serving.saturated_fat_g, 'g'],
                  ['Carbohydrates', recipe.nutrition_per_serving.carbohydrates_g, 'g'],
                  ['Dietary Fibre', recipe.nutrition_per_serving.fibre_g, 'g'],
                  ['Sugar', recipe.nutrition_per_serving.sugar_g, 'g'],
                  ['Sodium', recipe.nutrition_per_serving.sodium_mg, 'mg'],
                ].map(([label, value, unit]) => (
                  <tr key={label} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '5px 0' }}>{label}</td>
                    <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 500 }}>{value} {unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: '11px', color: '#999', lineHeight: '1.5' }}>⚠️ This recipe was generated by Chef Marco AI. Nutritional values are estimates only. Use of this app does not constitute medical or nutritional advice. Consult a qualified medical practitioner or dietitian before making significant dietary changes.</p>
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: '40px', paddingTop: '12px', borderTop: '1px solid #ddd', fontSize: '11px', color: '#999', textAlign: 'center' }}>
          Helix Kitchen — Powered by Chef Marco AI
        </div>
      </div>
    </div>
  )
}
