import { useState, useEffect } from 'react'

const AISLE_CONFIG = [
  { key: 'Produce',        emoji: '🥬', label: 'Produce' },
  { key: 'Meat & Seafood', emoji: '🥩', label: 'Meat & Seafood' },
  { key: 'Dairy & Eggs',   emoji: '🥛', label: 'Dairy & Eggs' },
  { key: 'Pantry',         emoji: '🫙', label: 'Pantry' },
  { key: 'Bakery',         emoji: '🍞', label: 'Bakery' },
  { key: 'Frozen',         emoji: '🧊', label: 'Frozen' },
  { key: 'Deli',           emoji: '🧀', label: 'Deli' },
  { key: 'Other',          emoji: '🛒', label: 'Other' },
]

function formatIngredient(ing) {
  const parts = []
  if (ing.amount) parts.push(ing.amount)
  if (ing.unit) parts.push(ing.unit)
  parts.push(ing.name)
  return parts.join(' ')
}

function groupByAisle(recipe) {
  const allIngredients = (recipe.meal_components || [{ ingredients: recipe.ingredients || [] }])
    .flatMap(c => c.ingredients || [])

  const groups = {}
  for (const ing of allIngredients) {
    const aisle = ing.aisle || 'Other'
    if (!groups[aisle]) groups[aisle] = []
    groups[aisle].push(ing)
  }
  return groups
}

export default function ShoppingList({ recipe, onClose }) {
  const [checked, setChecked] = useState({})
  const [copied, setCopied] = useState(false)

  // Reset checked state when recipe changes
  useEffect(() => {
    setChecked({})
  }, [recipe?.title])

  if (!recipe) return null

  const groups = groupByAisle(recipe)
  const orderedAisles = AISLE_CONFIG.filter(a => groups[a.key]?.length > 0)

  const totalItems = Object.values(groups).flat().length
  const checkedCount = Object.values(checked).filter(Boolean).length

  const toggleItem = (key) => {
    setChecked(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleAisle = (aisleKey) => {
    const items = groups[aisleKey] || []
    const allChecked = items.every((_, i) => checked[`${aisleKey}-${i}`])
    const next = {}
    items.forEach((_, i) => { next[`${aisleKey}-${i}`] = !allChecked })
    setChecked(prev => ({ ...prev, ...next }))
  }

  const handleCopy = () => {
    const lines = [`🛒 Shopping List — ${recipe.title}`, '']
    for (const { key, emoji, label } of AISLE_CONFIG) {
      if (!groups[key]?.length) continue
      lines.push(`${emoji} ${label}`)
      groups[key].forEach(ing => {
        lines.push(`  • ${formatIngredient(ing)}`)
      })
      lines.push('')
    }
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handlePrint = () => {
    const printContent = `
      <html><head><title>Shopping List</title>
      <style>
        body { font-family: Georgia, serif; max-width: 480px; margin: 32px auto; color: #1a1a2e; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        p.sub { color: #666; font-size: 13px; margin: 0 0 20px; }
        .aisle { margin-bottom: 18px; }
        .aisle-title { font-size: 15px; font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
        .item { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; font-size: 14px; }
        .box { width: 14px; height: 14px; border: 1.5px solid #666; border-radius: 2px; flex-shrink: 0; margin-top: 1px; }
      </style></head><body>
      <h1>🛒 Shopping List</h1>
      <p class="sub">${recipe.title}</p>
      ${orderedAisles.map(({ key, emoji, label }) => `
        <div class="aisle">
          <div class="aisle-title">${emoji} ${label}</div>
          ${groups[key].map(ing => `
            <div class="item"><div class="box"></div>${formatIngredient(ing)}</div>
          `).join('')}
        </div>
      `).join('')}
      </body></html>
    `
    const win = window.open('', '_blank')
    win.document.write(printContent)
    win.document.close()
    win.print()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-x-0 bottom-0 sm:inset-x-auto sm:right-0 sm:top-0 sm:w-[400px] z-50 flex flex-col bg-navy border-t sm:border-t-0 sm:border-l border-navy-lighter shadow-2xl max-h-[90vh] sm:max-h-screen rounded-t-2xl sm:rounded-t-none">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-navy-lighter shrink-0">
          <div>
            <h2 className="text-lg font-bold text-cream flex items-center gap-2">
              🛒 Shopping List
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[240px]">{recipe.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-cream hover:bg-navy-light transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-5 py-2 border-b border-navy-lighter/50 shrink-0">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>{checkedCount} of {totalItems} items</span>
            {checkedCount === totalItems && totalItems > 0 && (
              <span className="text-green-400 font-medium">All done! ✓</span>
            )}
          </div>
          <div className="h-1 bg-navy-lighter rounded-full overflow-hidden">
            <div
              className="h-full bg-gold rounded-full transition-all duration-300"
              style={{ width: totalItems > 0 ? `${(checkedCount / totalItems) * 100}%` : '0%' }}
            />
          </div>
        </div>

        {/* Ingredient list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {orderedAisles.map(({ key, emoji, label }) => {
            const items = groups[key]
            const aisleCheckedCount = items.filter((_, i) => checked[`${key}-${i}`]).length
            const allAisleChecked = aisleCheckedCount === items.length

            return (
              <div key={key}>
                {/* Aisle header */}
                <button
                  onClick={() => toggleAisle(key)}
                  className="w-full flex items-center justify-between mb-2 group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{emoji}</span>
                    <span className="text-sm font-semibold text-gold">{label}</span>
                    <span className="text-xs text-slate-500">({aisleCheckedCount}/{items.length})</span>
                  </div>
                  <span className="text-xs text-slate-500 group-hover:text-slate-300 transition-colors">
                    {allAisleChecked ? 'Uncheck all' : 'Check all'}
                  </span>
                </button>

                {/* Items */}
                <ul className="space-y-1.5">
                  {items.map((ing, i) => {
                    const itemKey = `${key}-${i}`
                    const isChecked = !!checked[itemKey]
                    return (
                      <li key={i}>
                        <button
                          onClick={() => toggleItem(itemKey)}
                          className="w-full flex items-start gap-3 text-left py-1.5 px-2 rounded-lg hover:bg-navy-light transition-colors cursor-pointer group"
                        >
                          <div className={`shrink-0 w-5 h-5 rounded border-2 mt-0.5 flex items-center justify-center transition-colors ${
                            isChecked
                              ? 'bg-gold border-gold'
                              : 'border-slate-600 group-hover:border-slate-400'
                          }`}>
                            {isChecked && (
                              <svg className="w-3 h-3 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={`text-sm flex-1 leading-snug transition-colors ${
                            isChecked ? 'line-through text-slate-600' : 'text-slate-300'
                          }`}>
                            {ing.amount && (
                              <span className={`font-medium ${isChecked ? 'text-slate-600' : 'text-cream'}`}>
                                {ing.amount}{ing.unit ? ` ${ing.unit}` : ''}
                              </span>
                            )}{' '}
                            {ing.name}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-navy-lighter shrink-0 flex gap-3">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-navy-lighter hover:border-gold/40 text-slate-300 hover:text-cream transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy list
              </>
            )}
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-gold/10 hover:bg-gold/20 text-gold border border-gold/20 hover:border-gold/40 transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        </div>
      </div>
    </>
  )
}
