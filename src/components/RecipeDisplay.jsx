import { useState, useEffect, useRef } from 'react'

const ALLERGEN_COLORS = {
  gluten: 'bg-amber-700/30 text-amber-300 border-amber-600/40',
  dairy: 'bg-blue-700/30 text-blue-300 border-blue-600/40',
  eggs: 'bg-yellow-700/30 text-yellow-300 border-yellow-600/40',
  nuts: 'bg-orange-700/30 text-orange-300 border-orange-600/40',
  shellfish: 'bg-red-700/30 text-red-300 border-red-600/40',
  soy: 'bg-green-700/30 text-green-300 border-green-600/40',
  sesame: 'bg-lime-700/30 text-lime-300 border-lime-600/40',
  fish: 'bg-cyan-700/30 text-cyan-300 border-cyan-600/40',
  celery: 'bg-emerald-700/30 text-emerald-300 border-emerald-600/40',
  mustard: 'bg-yellow-700/30 text-yellow-200 border-yellow-500/40',
  sulphites: 'bg-purple-700/30 text-purple-300 border-purple-600/40',
}

export default function RecipeDisplay({ recipe, onNewRecipe, isFavourite, onToggleFavourite, onPrint, onNutritionData }) {
  const [swapLoading, setSwapLoading] = useState(null)
  const [swapResult, setSwapResult] = useState(null)
  const [swapIndex, setSwapIndex] = useState(null)
  const [usdaNutrition, setUsdaNutrition] = useState(null)
  const [nutritionLoading, setNutritionLoading] = useState(false)
  const [nutritionSource, setNutritionSource] = useState('ai') // 'ai' | 'usda'
  const [notFoundIngredients, setNotFoundIngredients] = useState([])

  const lastLookupRef = useRef(null)

  useEffect(() => {
    if (!recipe) return
    const allIngredients = (recipe.meal_components || [{ ingredients: recipe.ingredients }])
      .flatMap(c => c.ingredients || [])
    if (allIngredients.length === 0) return

    // Prevent duplicate lookups (React StrictMode fires effects twice)
    const lookupKey = recipe.title + '|' + allIngredients.map(i => i.name).join(',')
    if (lastLookupRef.current === lookupKey) return
    lastLookupRef.current = lookupKey

    setNutritionLoading(true)
    setNutritionSource('ai')
    setUsdaNutrition(null)
    setNotFoundIngredients([])

    fetch('/api/nutrition-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredients: allIngredients,
        servings: recipe.servings || 4,
      }),
    })
      .then(res => {
        if (!res.ok) throw new Error('USDA lookup failed')
        return res.json()
      })
      .then(data => {
        console.log('[USDA] Response received:', data)
        if (data.fallback || !data.nutrition_per_serving) {
          // USDA lookup failed or timed out — keep Marco's estimates
          console.log('[USDA] Falling back to AI estimates (fallback flag or missing data)')
          setNutritionSource('ai')
        } else {
          console.log('[USDA] Setting nutrition state:', data.nutrition_per_serving)
          setUsdaNutrition(data.nutrition_per_serving)
          setNutritionSource('usda')
          setNotFoundIngredients(data.not_found || [])
          onNutritionData?.(data.nutrition_per_serving, data)
        }
      })
      .catch((err) => {
        console.error('[USDA] Lookup error:', err)
        // Fall back to AI estimates silently
        setNutritionSource('ai')
      })
      .finally(() => {
        setNutritionLoading(false)
      })
  }, [recipe])

  const formatTime = (seconds) => {
    if (!seconds) return null
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs ? `${mins}m ${secs}s` : `${mins} min`
  }

  const handleSwap = async (ing, index) => {
    if (swapIndex === index) {
      setSwapIndex(null)
      setSwapResult(null)
      return
    }
    setSwapIndex(index)
    setSwapLoading(index)
    setSwapResult(null)
    try {
      const res = await fetch('/api/swap-ingredient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient: `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim(),
          recipeTitle: recipe.title,
          allIngredients: (recipe.meal_components || [{ ingredients: recipe.ingredients }]).flatMap(c => (c.ingredients || []).map(i => i.name)),
        }),
      })
      const data = await res.json()
      setSwapResult(data.substitutes || [])
    } catch {
      setSwapResult([{ name: 'Error', note: 'Could not load substitutes. Please try again.' }])
    } finally {
      setSwapLoading(null)
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Title & description */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-cream">
            {recipe.title}
          </h1>
        </div>

        {/* Nutrition mode badges */}
        {recipe.nutritionMode && (
          <div className="flex flex-wrap justify-center gap-2 mb-3">
            {(Array.isArray(recipe.nutritionMode) ? recipe.nutritionMode : [recipe.nutritionMode])
              .filter((m) => m !== 'Balanced')
              .map((mode) => (
                <span key={mode} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gold/15 text-gold border border-gold/25">
                  {mode}
                </span>
              ))}
          </div>
        )}

        <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
          {recipe.description}
        </p>

        {/* Allergen badges */}
        {/* Prep time, cooking time & difficulty */}
        {(recipe.prep_time_minutes || recipe.cooking_time_minutes || recipe.difficulty) && (
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {recipe.prep_time_minutes != null && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-navy-light border border-navy-lighter/50 text-slate-300">
                <svg className="w-3.5 h-3.5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Prep: {recipe.prep_time_minutes} min
              </span>
            )}
            {recipe.cooking_time_minutes != null && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-navy-light border border-navy-lighter/50 text-slate-300">
                <svg className="w-3.5 h-3.5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Cook: {recipe.cooking_time_minutes} min
              </span>
            )}
            {recipe.difficulty && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                recipe.difficulty === 'easy' ? 'bg-green-900/30 text-green-300 border-green-600/40' :
                recipe.difficulty === 'medium' ? 'bg-amber-900/30 text-amber-300 border-amber-600/40' :
                'bg-red-900/30 text-red-300 border-red-600/40'
              }`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}
              </span>
            )}
          </div>
        )}

        {recipe.allergens && recipe.allergens.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {recipe.allergens.map((allergen) => (
              <span
                key={allergen}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                  ALLERGEN_COLORS[allergen] || 'bg-slate-700/30 text-slate-300 border-slate-600/40'
                }`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {allergen.charAt(0).toUpperCase() + allergen.slice(1)}
              </span>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={onToggleFavourite}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer border border-navy-lighter hover:border-gold/30"
            title={isFavourite ? 'Remove from favourites' : 'Save to favourites'}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill={isFavourite ? '#C8952A' : 'none'} stroke={isFavourite ? '#C8952A' : 'currentColor'} strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span className={isFavourite ? 'text-gold' : 'text-slate-400'}>
              {isFavourite ? 'Saved' : 'Save'}
            </span>
          </button>
          <button
            onClick={onPrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-slate-400 transition-all cursor-pointer border border-navy-lighter hover:border-gold/30 hover:text-cream"
            title="Print recipe"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        </div>
      </div>

      {/* Meal Components */}
      {(recipe.meal_components || [{ component_name: null, ingredients: recipe.ingredients, steps: recipe.steps }]).map((component, ci) => {
        const ingredientOffset = (recipe.meal_components || []).slice(0, ci).reduce((sum, c) => sum + (c.ingredients?.length || 0), 0)
        return (
          <div key={ci} className="space-y-6">
            {component.component_name && (
              <h2 className="text-xl font-bold text-cream border-b border-gold/20 pb-2 mt-2">
                {component.component_name}
              </h2>
            )}

            {/* Ingredients */}
            <div className="bg-navy-light rounded-xl p-6 border border-navy-lighter/50">
              <h3 className="text-lg font-semibold text-gold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Ingredients
              </h3>
              <ul className="space-y-2">
                {(component.ingredients || []).map((ing, i) => {
                  const globalIndex = ingredientOffset + i
                  return (
                    <li key={i} className="relative">
                      <div className="flex items-start gap-2 text-slate-300">
                        <span className="text-gold/60 mt-1 shrink-0">•</span>
                        <span className="flex-1">
                          {ing.amount && (
                            <span className="font-medium text-cream">
                              {ing.amount}{ing.unit ? ` ${ing.unit}` : ''}
                            </span>
                          )}{' '}
                          {ing.name}
                        </span>
                        <button
                          onClick={() => handleSwap(ing, globalIndex)}
                          className={`shrink-0 p-1 rounded transition-colors cursor-pointer ${
                            swapIndex === globalIndex ? 'text-gold bg-gold/10' : 'text-slate-500 hover:text-gold/70'
                          }`}
                          title="Suggest substitutes"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </button>
                      </div>
                      {swapIndex === globalIndex && (
                        <div className="mt-2 ml-5 p-3 bg-navy rounded-lg border border-gold/20 text-sm">
                          {swapLoading === globalIndex ? (
                            <div className="flex items-center gap-2 text-slate-400">
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Chef Marco is thinking...
                            </div>
                          ) : swapResult ? (
                            <div className="space-y-2">
                              <p className="text-gold text-xs font-semibold uppercase tracking-wide">Substitutes</p>
                              {swapResult.map((sub, si) => (
                                <div key={si} className="flex gap-2">
                                  <span className="text-gold shrink-0">→</span>
                                  <div>
                                    <span className="font-medium text-cream">{sub.name}</span>
                                    {sub.note && <span className="text-slate-400"> — {sub.note}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* Steps */}
            <div className="bg-navy-light rounded-xl p-6 border border-navy-lighter/50">
              <h3 className="text-lg font-semibold text-gold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Method
              </h3>
              <ol className="space-y-5">
                {(component.steps || []).map((step, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-gold/15 text-gold text-sm font-semibold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      {step.title && (
                        <h3 className="font-medium text-cream mb-1">{step.title}</h3>
                      )}
                      <p className="text-slate-300 leading-relaxed">{step.instruction}</p>
                      {step.timer_seconds > 0 && (
                        <span className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-gold/80 bg-gold/10 px-2 py-1 rounded">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatTime(step.timer_seconds)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )
      })}

      {/* Chef Marco Tips */}
      {recipe.tips && recipe.tips.length > 0 && (
        <div className="bg-gold/8 rounded-xl p-6 border border-gold/20">
          <h2 className="text-lg font-semibold text-gold mb-4 flex items-center gap-2">
            <span className="text-xl">👨‍🍳</span>
            Chef Marco says...
          </h2>
          <ul className="space-y-3">
            {recipe.tips.map((tip, i) => (
              <li key={i} className="flex gap-3 text-slate-300">
                <span className="text-gold shrink-0 mt-0.5">★</span>
                <p className="leading-relaxed">{tip}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes */}
      {recipe.notes && (
        <div className="bg-gold/5 rounded-xl p-6 border border-gold/15">
          <h2 className="text-lg font-semibold text-gold mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Chef Marco's Notes
          </h2>
          <p className="text-slate-300 leading-relaxed">{recipe.notes}</p>
        </div>
      )}

      {/* Nutrition */}
      {recipe.nutrition_per_serving && (() => {
        const nutrition = nutritionSource === 'usda' && usdaNutrition ? usdaNutrition : recipe.nutrition_per_serving
        return (
          <div className="bg-navy-light rounded-xl p-6 border border-navy-lighter/50 relative">
            <h2 className="text-lg font-semibold text-gold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18" />
              </svg>
              Nutrition Per Serving (Full Meal)
            </h2>
            {nutritionLoading && (
              <div className="absolute inset-0 bg-navy-light/80 rounded-xl flex items-center justify-center z-10">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Calculating nutrition from USDA database...
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-lighter">
                    <th className="text-left text-gold/80 font-medium py-2 pr-4">Nutrient</th>
                    <th className="text-right text-gold/80 font-medium py-2 pl-4">Amount</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {[
                    ['Calories', nutrition.calories, 'kcal'],
                    ['Protein', nutrition.protein_g, 'g'],
                    ['Total Fat', nutrition.total_fat_g, 'g'],
                    ['Saturated Fat', nutrition.saturated_fat_g, 'g'],
                    ['Carbohydrates', nutrition.carbohydrates_g, 'g'],
                    ['Dietary Fibre', nutrition.fibre_g, 'g'],
                    ['Sugar', nutrition.sugar_g, 'g'],
                    ['Sodium', nutrition.sodium_mg, 'mg'],
                  ].map(([label, value, unit]) => (
                    <tr key={label} className="border-b border-navy-lighter/30">
                      <td className="py-2 pr-4">{label}</td>
                      <td className="py-2 pl-4 text-right text-cream font-medium">
                        {value} {unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {notFoundIngredients.length > 0 && nutritionSource === 'usda' && (
              <p className="text-xs text-slate-500 opacity-70 mt-2">
                Could not find USDA data for: {notFoundIngredients.join(', ')}
              </p>
            )}
            {nutritionSource === 'usda' ? (
              <p className="text-xs text-slate-500 opacity-60 mt-3 leading-relaxed">Nutrition calculated using USDA FoodData Central</p>
            ) : (
              <p className="text-xs text-slate-500 opacity-60 mt-3 leading-relaxed">⚠️ This recipe was generated by Chef Marco AI. Nutritional values are estimates only. Use of this app does not constitute medical or nutritional advice. Consult a qualified medical practitioner or dietitian before making significant dietary changes.</p>
            )}
          </div>
        )
      })()}

      {/* New recipe button */}
      <div className="pt-4 pb-8">
        <button
          onClick={onNewRecipe}
          className="w-full bg-navy-lighter hover:bg-navy-lighter/80 text-cream font-medium py-4 px-6 rounded-xl transition-colors border border-navy-lighter cursor-pointer"
        >
          Cook Something Else
        </button>
      </div>
    </div>
  )
}
