import { useState, useEffect, useRef } from 'react'
import ShoppingList from './ShoppingList'

// Health labels Edamam returns that are relevant to longevity/functional medicine
const HEALTH_LABEL_CONFIG = {
  VEGAN:         { label: 'Vegan',          color: 'bg-green-800/30 text-green-300 border-green-600/40',   emoji: '🌱' },
  VEGETARIAN:    { label: 'Vegetarian',     color: 'bg-emerald-800/30 text-emerald-300 border-emerald-600/40', emoji: '🥦' },
  PESCATARIAN:   { label: 'Pescatarian',    color: 'bg-cyan-800/30 text-cyan-300 border-cyan-600/40',     emoji: '🐟' },
  PALEO:         { label: 'Paleo',          color: 'bg-amber-800/30 text-amber-300 border-amber-600/40',  emoji: '🦴' },
  KETO_FRIENDLY: { label: 'Keto Friendly',  color: 'bg-purple-800/30 text-purple-300 border-purple-600/40', emoji: '⚡' },
  WHOLE30:       { label: 'Whole30',        color: 'bg-orange-800/30 text-orange-300 border-orange-600/40', emoji: '🎯' },
  MEDITERRANEAN: { label: 'Mediterranean',  color: 'bg-blue-800/30 text-blue-300 border-blue-600/40',    emoji: '🫒' },
  DASH:          { label: 'DASH',           color: 'bg-sky-800/30 text-sky-300 border-sky-600/40',       emoji: '💙' },
  GLUTEN_FREE:   { label: 'Gluten Free',    color: 'bg-yellow-800/30 text-yellow-300 border-yellow-600/40', emoji: '🌾' },
  DAIRY_FREE:    { label: 'Dairy Free',     color: 'bg-indigo-800/30 text-indigo-300 border-indigo-600/40', emoji: '🥛' },
  EGG_FREE:      { label: 'Egg Free',       color: 'bg-yellow-800/30 text-yellow-200 border-yellow-500/40', emoji: '🥚' },
  SOY_FREE:      { label: 'Soy Free',       color: 'bg-lime-800/30 text-lime-300 border-lime-600/40',    emoji: '🫘' },
}

// Diet classification labels from Edamam (independent verification)
const DIET_LABEL_CONFIG = {
  HIGH_PROTEIN: { label: 'High Protein', color: 'bg-red-800/30 text-red-300 border-red-600/40' },
  LOW_CARB:     { label: 'Low Carb',     color: 'bg-purple-800/30 text-purple-300 border-purple-600/40' },
  LOW_FAT:      { label: 'Low Fat',      color: 'bg-sky-800/30 text-sky-300 border-sky-600/40' },
  HIGH_FIBER:   { label: 'High Fibre',   color: 'bg-green-800/30 text-green-300 border-green-600/40' },
  LOW_SODIUM:   { label: 'Low Sodium',   color: 'bg-teal-800/30 text-teal-300 border-teal-600/40' },
}

// Carbon footprint class colours (A+ = cleanest, G = highest impact)
const CO2_CLASS_CONFIG = {
  'A+': { color: 'bg-green-700/30 text-green-300 border-green-600/40' },
  'A':  { color: 'bg-green-700/30 text-green-300 border-green-600/40' },
  'B':  { color: 'bg-lime-700/30 text-lime-300 border-lime-600/40' },
  'C':  { color: 'bg-yellow-700/30 text-yellow-300 border-yellow-600/40' },
  'D':  { color: 'bg-amber-700/30 text-amber-300 border-amber-600/40' },
  'E':  { color: 'bg-orange-700/30 text-orange-300 border-orange-600/40' },
  'F':  { color: 'bg-red-700/30 text-red-300 border-red-600/40' },
  'G':  { color: 'bg-red-800/30 text-red-400 border-red-700/40' },
}

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

export default function RecipeDisplay({ recipe, onNewRecipe, isFavourite, onToggleFavourite, onPrint, onNutritionData, onCacheNutrition }) {
  const [swapLoading, setSwapLoading] = useState(null)
  const [swapResult, setSwapResult] = useState(null)
  const [swapIndex, setSwapIndex] = useState(null)
  const [usdaNutrition, setUsdaNutrition] = useState(null)
  const [nutritionLoading, setNutritionLoading] = useState(false)
  const [nutritionSource, setNutritionSource] = useState('ai') // 'ai' | 'edamam'
  const [notFoundIngredients, setNotFoundIngredients] = useState([])
  const [showShoppingList, setShowShoppingList] = useState(false)
  const [edamamMeta, setEdamamMeta] = useState(null) // health labels, diet labels, CO2

  const lastLookupRef = useRef(null)

  useEffect(() => {
    if (!recipe) return

    // ── Cache hit: nutrition already stored in the recipe object ──────────────
    if (recipe._edamamNutrition) {
      const cached = recipe._edamamNutrition
      setUsdaNutrition(cached.nutrition_per_serving)
      setNutritionSource('edamam')
      setNotFoundIngredients(cached.not_found || [])
      setEdamamMeta({
        healthLabels: cached.health_labels || [],
        dietLabels:   cached.diet_labels   || [],
        co2Class:     cached.co2_emissions_class        || null,
        co2PerServing: cached.co2_emissions_per_serving || null,
      })
      onNutritionData?.(cached.nutrition_per_serving, cached)
      return
    }

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
        if (!res.ok) throw new Error('Edamam lookup failed')
        return res.json()
      })
      .then(data => {
        console.log('[EDAMAM] Response received:', data)
        if (data.fallback || !data.nutrition_per_serving) {
          console.log('[EDAMAM] Falling back to AI estimates (fallback flag or missing data)')
          setNutritionSource('ai')
        } else {
          console.log('[EDAMAM] Setting nutrition state:', data.nutrition_per_serving)
          setUsdaNutrition(data.nutrition_per_serving)
          setNutritionSource('edamam')
          setNotFoundIngredients(data.not_found || [])
          setEdamamMeta({
            healthLabels:  data.health_labels              || [],
            dietLabels:    data.diet_labels                || [],
            co2Class:      data.co2_emissions_class        || null,
            co2PerServing: data.co2_emissions_per_serving  || null,
          })
          onNutritionData?.(data.nutrition_per_serving, data)
          // Cache the result in the recipe object so future views skip this call
          onCacheNutrition?.(data)
        }
      })
      .catch((err) => {
        console.error('[EDAMAM] Lookup error:', err)
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

  // Derive key nutrition numbers for macro badges
  const nutritionData = usdaNutrition || recipe.nutrition_per_serving || null
  const aiNutrition   = recipe.nutrition_per_serving || null

  const macroCalories = nutritionData?.calories ?? aiNutrition?.calories ?? null
  const macroProtein  = nutritionData ? Math.round(nutritionData.protein_g ?? 0) : (aiNutrition ? Math.round(aiNutrition.protein_g ?? 0) : null)
  const macroCarbs    = nutritionData ? Math.round(nutritionData.carbohydrates_g ?? 0) : (aiNutrition ? Math.round(aiNutrition.carbohydrates_g ?? 0) : null)
  const macroFat      = nutritionData ? Math.round(nutritionData.total_fat_g ?? 0) : (aiNutrition ? Math.round(aiNutrition.total_fat_g ?? 0) : null)
  const showMacros    = macroCalories !== null

  const totalCookTime = (recipe.prep_time_minutes || 0) + (recipe.cooking_time_minutes || 0)

  return (
    <div className="animate-fade-in space-y-4">

      {/* ── HERO CARD ───────────────────────────────────────────────── */}
      <div className="hk-card overflow-hidden">

        {/* Hero gradient banner */}
        <div className="hk-hero px-6 pt-8 pb-6">
          {/* Top row: time badge + favourite button */}
          <div className="relative flex items-start justify-between mb-5">
            {totalCookTime > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-navy/60 border border-gold/30 text-gold backdrop-blur-sm">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {totalCookTime} min
              </span>
            ) : <span />}

            {/* Heart / save button */}
            <button
              onClick={onToggleFavourite}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer border border-gold/30 bg-navy/60 backdrop-blur-sm hover:bg-navy/80"
              title={isFavourite ? 'Remove from favourites' : 'Save to favourites'}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill={isFavourite ? '#C8952A' : 'none'} stroke={isFavourite ? '#C8952A' : '#94a3b8'} strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          </div>

          {/* Title */}
          <div className="mb-1">
            <p className="hk-section-heading">Featured Recipe</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-cream leading-tight">
              {recipe.title}
            </h1>
          </div>

          {/* Description */}
          <p className="text-slate-400 text-sm leading-relaxed mt-2 line-clamp-2">
            {recipe.description}
          </p>

          {/* Action row */}
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 transition-all cursor-pointer border border-navy-lighter/60 hover:border-gold/30 hover:text-cream bg-navy/40"
              title="Print recipe"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            <button
              onClick={() => setShowShoppingList(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 transition-all cursor-pointer border border-navy-lighter/60 hover:border-gold/30 hover:text-cream bg-navy/40"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Shopping list
            </button>
          </div>
        </div>

        {/* ── MACRO BADGES ─────────────────────────────────────────── */}
        {(showMacros || nutritionLoading) && (
          <div className="px-6 py-5 border-t border-gold/10">
            <p className="hk-section-heading mb-4">Macros Per Serving</p>
            {nutritionLoading ? (
              <div className="flex gap-5 justify-around">
                {[1,2,3,4].map(i => (
                  <div key={i} className="macro-badge opacity-40 animate-pulse">
                    <div className="macro-badge-ring border-slate-600" style={{width:56,height:56}} />
                    <div className="w-8 h-2 rounded bg-slate-700 mt-1" />
                    <div className="w-10 h-2 rounded bg-slate-800 mt-0.5" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-3 justify-around">
                {/* Protein */}
                <div className="macro-badge">
                  <div className="macro-badge-ring border-green-500/60" style={{borderColor:'rgba(34,197,94,0.6)'}}>
                    🥩
                  </div>
                  <span className="macro-badge-value">{macroProtein}g</span>
                  <span className="macro-badge-label">Protein</span>
                </div>
                {/* Carbs */}
                <div className="macro-badge">
                  <div className="macro-badge-ring" style={{borderColor:'rgba(234,179,8,0.6)'}}>
                    🌾
                  </div>
                  <span className="macro-badge-value">{macroCarbs}g</span>
                  <span className="macro-badge-label">Carbs</span>
                </div>
                {/* Fats */}
                <div className="macro-badge">
                  <div className="macro-badge-ring" style={{borderColor:'rgba(249,115,22,0.6)'}}>
                    🫒
                  </div>
                  <span className="macro-badge-value">{macroFat}g</span>
                  <span className="macro-badge-label">Fats</span>
                </div>
                {/* Calories */}
                <div className="macro-badge">
                  <div className="macro-badge-ring" style={{borderColor:'rgba(200,149,42,0.7)'}}>
                    🔥
                  </div>
                  <span className="macro-badge-value">{Math.round(macroCalories)}</span>
                  <span className="macro-badge-label">Calories</span>
                </div>
              </div>
            )}
            {nutritionSource === 'edamam' && !nutritionLoading && (
              <p className="text-center text-[10px] text-slate-600 mt-3">Verified by Edamam · per serving</p>
            )}
            {nutritionSource === 'ai' && !nutritionLoading && showMacros && (
              <p className="text-center text-[10px] text-slate-600 mt-3">AI estimate · per serving</p>
            )}
          </div>
        )}

        {/* ── DIET / HEALTH TAGS ────────────────────────────────────── */}
        {(() => {
          const modeBadges = recipe.nutritionMode
            ? (Array.isArray(recipe.nutritionMode) ? recipe.nutritionMode : [recipe.nutritionMode]).filter(m => m !== 'Balanced')
            : []
          const allergenBadges = recipe.allergens || []
          const healthBadges = edamamMeta ? (edamamMeta.healthLabels || []).map(k => HEALTH_LABEL_CONFIG[k]).filter(Boolean) : []
          const dietBadges   = edamamMeta ? (edamamMeta.dietLabels   || []).map(k => DIET_LABEL_CONFIG[k]).filter(Boolean)   : []
          const difficultyBadge = recipe.difficulty
          const prepBadge = recipe.prep_time_minutes
          const hasTags = modeBadges.length || allergenBadges.length || healthBadges.length || dietBadges.length || difficultyBadge || prepBadge
          if (!hasTags) return null
          return (
            <div className="px-6 pb-5 border-t border-gold/10 pt-4">
              <p className="hk-section-heading mb-3">Details</p>
              <div className="flex flex-wrap gap-1.5">
                {prepBadge != null && (
                  <span className="hk-pill bg-navy-lighter/40 border-navy-lighter/60 text-slate-300">
                    ✏️ Prep {prepBadge} min
                  </span>
                )}
                {difficultyBadge && (
                  <span className={`hk-pill border ${
                    difficultyBadge === 'easy' ? 'bg-green-900/30 text-green-300 border-green-600/40' :
                    difficultyBadge === 'medium' ? 'bg-amber-900/30 text-amber-300 border-amber-600/40' :
                    'bg-red-900/30 text-red-300 border-red-600/40'
                  }`}>
                    ⚡ {difficultyBadge.charAt(0).toUpperCase() + difficultyBadge.slice(1)}
                  </span>
                )}
                {modeBadges.map(m => (
                  <span key={m} className="hk-pill bg-gold/10 text-gold border-gold/25">{m}</span>
                ))}
                {healthBadges.map(cfg => (
                  <span key={cfg.label} className={`hk-pill ${cfg.color}`}>{cfg.emoji} {cfg.label}</span>
                ))}
                {dietBadges.map(cfg => (
                  <span key={cfg.label} className={`hk-pill ${cfg.color}`}>✓ {cfg.label}</span>
                ))}
                {allergenBadges.map(a => (
                  <span key={a} className={`hk-pill ${ALLERGEN_COLORS[a] || 'bg-slate-700/30 text-slate-300 border-slate-600/40'}`}>
                    ⚠️ {a.charAt(0).toUpperCase() + a.slice(1)}
                  </span>
                ))}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Shopping List Modal */}
      {showShoppingList && (
        <ShoppingList recipe={recipe} onClose={() => setShowShoppingList(false)} />
      )}

      {/* Meal Components */}
      {(recipe.meal_components || [{ component_name: null, ingredients: recipe.ingredients, steps: recipe.steps }]).map((component, ci) => {
        const ingredientOffset = (recipe.meal_components || []).slice(0, ci).reduce((sum, c) => sum + (c.ingredients?.length || 0), 0)
        return (
          <div key={ci} className="space-y-4">
            {component.component_name && (
              <h2 className="text-lg font-bold text-cream border-b border-gold/20 pb-2 mt-2 px-1">
                {component.component_name}
              </h2>
            )}

            {/* Ingredients */}
            <div className="hk-card p-6">
              <p className="hk-section-heading flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Ingredients
              </p>
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
            <div className="hk-card p-6">
              <p className="hk-section-heading flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Method
              </p>
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
        <div className="hk-card p-6 border-gold/20">
          <p className="hk-section-heading flex items-center gap-2">
            <span>👨‍🍳</span> Chef Marco Says
          </p>
          <ul className="space-y-3">
            {recipe.tips.map((tip, i) => (
              <li key={i} className="flex gap-3 text-slate-300">
                <span className="text-gold shrink-0 mt-0.5">★</span>
                <p className="leading-relaxed text-sm">{tip}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes */}
      {recipe.notes && (
        <div className="hk-card p-6">
          <p className="hk-section-heading flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Chef Marco's Notes
          </p>
          <p className="text-slate-300 leading-relaxed text-sm">{recipe.notes}</p>
        </div>
      )}

      {/* Nutrition */}
      {recipe.nutrition_per_serving && (() => {
        const nutrition = nutritionSource === 'edamam' && usdaNutrition ? usdaNutrition : recipe.nutrition_per_serving
        return (
          <div className="hk-card p-6 relative">
            <p className="hk-section-heading flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18" />
              </svg>
              Full Nutrition Per Serving
            </p>
            {nutritionLoading && (
              <div className="absolute inset-0 bg-navy-light/80 rounded-xl flex items-center justify-center z-10">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Calculating nutrition...
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
            {notFoundIngredients.length > 0 && nutritionSource === 'edamam' && (
              <p className="text-xs text-slate-500 opacity-70 mt-2">
                Could not match: {notFoundIngredients.join(', ')}
              </p>
            )}
            {nutritionSource === 'edamam' ? (
              <div className="mt-3 space-y-2">
                {edamamMeta?.co2Class && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-500">Carbon footprint:</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${CO2_CLASS_CONFIG[edamamMeta.co2Class]?.color || 'bg-slate-700/30 text-slate-300 border-slate-600/40'}`}>
                      🌱 {edamamMeta.co2Class}
                    </span>
                    {edamamMeta.co2PerServing && (
                      <span className="text-xs text-slate-500">{edamamMeta.co2PerServing}g CO₂ / serving</span>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs text-slate-500 opacity-60 leading-relaxed">Nutrition data from Edamam</p>
                  <a
                    href="https://www.edamam.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 opacity-60 hover:opacity-90 transition-opacity"
                    title="Powered by Edamam"
                  >
                    <span className="text-xs text-slate-400">Powered by</span>
                    <span className="text-xs font-semibold text-[#6aad48]">Edamam</span>
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 opacity-60 mt-3 leading-relaxed">⚠️ This recipe was generated by Chef Marco AI. Nutritional values are estimates only. Use of this app does not constitute medical or nutritional advice. Consult a qualified medical practitioner or dietitian before making significant dietary changes.</p>
            )}
          </div>
        )
      })()}

      {/* New recipe button */}
      <div className="pt-2 pb-4">
        <button
          onClick={onNewRecipe}
          className="w-full bg-gold/10 hover:bg-gold/20 text-gold font-semibold py-4 px-6 rounded-2xl transition-all border border-gold/25 hover:border-gold/50 cursor-pointer flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Cook Something Else
        </button>
      </div>
    </div>
  )
}
