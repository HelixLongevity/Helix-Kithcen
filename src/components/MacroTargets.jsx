import { useState, useMemo, useEffect } from 'react'

const COOKING_METHODS = [
  'No preference',
  'Stove top',
  'Oven',
  'Slow cooker',
  'BBQ',
  'Microwave',
]

const MACRO_MODES = ['minimum', 'maximum']

function MacroToggle({ value, onChange }) {
  return (
    <div className="flex bg-navy rounded-lg border border-navy-lighter p-0.5 text-xs">
      {MACRO_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`px-2 py-1 rounded-md font-medium transition-all cursor-pointer capitalize ${
            value === mode
              ? 'bg-gold text-navy shadow-sm'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          {mode}
        </button>
      ))}
    </div>
  )
}

// Map macro_match keys to USDA nutrition_per_serving field names
const USDA_KEY_MAP = {
  calories: 'calories',
  protein: 'protein_g',
  carbohydrates: 'carbohydrates_g',
  fat: 'total_fat_g',
  fibre: 'fibre_g',
  sugar: 'sugar_g',
  sodium: 'sodium_mg',
}

// Map macro keys to the mode keys used in macroFormData
const MODE_KEY_MAP = {
  calories: null, // calories is always 'exact'
  protein: 'proteinMode',
  carbohydrates: 'carbsMode',
  fat: 'fatMode',
  fibre: 'fibreMode',
  sugar: null, // sugar is always 'maximum'
  sodium: null, // sodium is always 'maximum'
}

const DEFAULT_MODE = {
  calories: 'exact',
  sugar: 'maximum',
  sodium: 'maximum',
}

function buildMacroSummary(entries, macroModes) {
  return entries.map(([key, { target, actual, unit, mode }]) => {
    const effectiveMode = mode || 'exact'
    const diff = actual - target
    const absPct = target > 0 ? Math.round(Math.abs(diff / target) * 100) : 0

    let status // 'good' | 'warn' | 'bad'
    let label

    if (effectiveMode === 'minimum') {
      if (actual >= target) {
        status = 'good'
        label = `hit minimum target (${actual}${unit} vs ${target}${unit} min)`
      } else if (absPct <= 20) {
        status = 'warn'
        label = `${absPct}% below minimum (${actual}${unit} vs ${target}${unit} min)`
      } else {
        status = 'bad'
        label = `${absPct}% below minimum (${actual}${unit} vs ${target}${unit} min)`
      }
    } else if (effectiveMode === 'maximum') {
      if (actual <= target) {
        status = 'good'
        label = `within maximum (${actual}${unit} vs ${target}${unit} max)`
      } else if (absPct <= 20) {
        status = 'warn'
        label = `${absPct}% over maximum (${actual}${unit} vs ${target}${unit} max)`
      } else {
        status = 'bad'
        label = `${absPct}% over maximum (${actual}${unit} vs ${target}${unit} max)`
      }
    } else {
      // exact
      if (absPct <= 10) {
        status = 'good'
        label = `on target (${actual}${unit} vs ${target}${unit})`
      } else if (absPct <= 20) {
        status = 'warn'
        label = `${absPct}% ${diff > 0 ? 'over' : 'under'} target (${actual}${unit} vs ${target}${unit})`
      } else {
        status = 'bad'
        label = `${absPct}% ${diff > 0 ? 'over' : 'under'} target (${actual}${unit} vs ${target}${unit})`
      }
    }

    return { key, status, label }
  })
}

function InteractiveRefinement({ suggestions, macroMatch, usdaNutrition, entries, onApplyRefined, onApplyCustomRefined, recipeIngredients, nutritionDetails, servings }) {
  // Track which suggestions are checked and their slider quantities
  const [checked, setChecked] = useState(() => suggestions.map(() => true))
  const [quantities, setQuantities] = useState(() =>
    suggestions.map(s => s.suggested_quantity_g || 0)
  )

  // Build per-ingredient data: match recipe ingredients to USDA nutrition details
  const ingredientData = useMemo(() => {
    if (!recipeIngredients) return []
    const numServings = servings || 1
    console.log('[REFINEMENT] Building ingredientData:', recipeIngredients.length, 'ingredients,', nutritionDetails?.length || 0, 'USDA details, servings:', numServings)
    return recipeIngredients.map(ing => {
      const ingLower = (ing.name || '').toLowerCase().trim()
      // Match by: exact name, or partial match in either direction
      const detail = nutritionDetails?.find(d => {
        if (!d.found || !d.name || !ingLower) return false
        const dLower = d.name.toLowerCase().trim()
        return dLower === ingLower || dLower.includes(ingLower) || ingLower.includes(dLower)
      })
      // Nutrients from the USDA lookup are for the ingredient's full quantity in the whole recipe
      // Store both whole-recipe and per-serving values
      const wholeRecipe = detail?.nutrients ? {
        calories: Math.round(detail.nutrients.calories),
        protein: Math.round(detail.nutrients.protein_g || 0),
        fat: Math.round(detail.nutrients.total_fat_g || 0),
        carbs: Math.round(detail.nutrients.carbohydrates_g || 0),
        fibre: Math.round(detail.nutrients.fibre_g || 0),
      } : null
      const perServing = wholeRecipe ? {
        calories: Math.round(wholeRecipe.calories / numServings),
        protein: Math.round(wholeRecipe.protein / numServings),
        fat: Math.round(wholeRecipe.fat / numServings),
        carbs: Math.round(wholeRecipe.carbs / numServings),
        fibre: Math.round(wholeRecipe.fibre / numServings),
      } : null
      if (!detail) {
        console.log(`[REFINEMENT] ❌ No USDA match for "${ing.name}" — available details:`, nutritionDetails?.map(d => d.name))
      } else if (!detail.nutrients) {
        console.log(`[REFINEMENT] ⚠️ USDA match for "${ing.name}" → "${detail.name}" but NO nutrients data`)
      } else {
        console.log(`[REFINEMENT] ✅ "${ing.name}" → "${detail.name}" per-serving:`, perServing)
      }
      return {
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit || 'g',
        wholeRecipe,
        perServing,
      }
    })
  }, [recipeIngredients, nutritionDetails, servings])

  // Track which recipe ingredients are kept (checked = kept)
  const [ingredientKept, setIngredientKept] = useState([])
  const [ingredientQuantities, setIngredientQuantities] = useState([])
  // Reset to all-checked when ingredient list changes
  useEffect(() => {
    setIngredientKept(ingredientData.map(() => true))
    setIngredientQuantities(ingredientData.map(ing => parseFloat(ing.amount) || 0))
  }, [ingredientData.length])

  const toggleIngredientKept = (i) => {
    setIngredientKept(prev => { const next = [...prev]; next[i] = !next[i]; return next })
  }

  // Add Ingredient state
  const [addedIngredients, setAddedIngredients] = useState([])
  const [addName, setAddName] = useState('')
  const [addQuantity, setAddQuantity] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState(null)

  const toggleCheck = (i) => {
    setChecked(prev => { const next = [...prev]; next[i] = !next[i]; return next })
  }

  const setQuantity = (i, val) => {
    setQuantities(prev => { const next = [...prev]; next[i] = val; return next })
  }

  // Added ingredient helpers
  const toggleAddedCheck = (i) => {
    setAddedIngredients(prev => prev.map((a, j) => j === i ? { ...a, checked: !a.checked } : a))
  }
  const setAddedQuantity = (i, val) => {
    setAddedIngredients(prev => prev.map((a, j) => j === i ? { ...a, quantity: val } : a))
  }

  const handleAddIngredient = async () => {
    const name = addName.trim()
    const qty = parseInt(addQuantity)
    if (!name || !qty || qty <= 0) return

    setAddLoading(true)
    setAddError(null)
    try {
      const res = await fetch('/api/nutrition-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'single', ingredientName: name }),
      })
      const data = await res.json()
      if (!data.found) {
        setAddError(`Could not find "${name}" in USDA database`)
        return
      }
      setAddedIngredients(prev => [...prev, {
        ingredient: name,
        description: `Add ${qty}g ${data.usda_match || name}`,
        usda_match: data.usda_match,
        quantity: qty,
        entered_quantity: qty,
        usda_per_100g: data.usda_per_100g,
        checked: true,
      }])
      setAddName('')
      setAddQuantity('')
    } catch {
      setAddError('Failed to look up ingredient')
    } finally {
      setAddLoading(false)
    }
  }

  // Calculate live preview of PER-SERVING recipe macros.
  // All values in this calculation are PER-SERVING:
  //   - entries.actual = per-serving from USDA/macro_match
  //   - ingredientData.perServing = whole-recipe USDA nutrients ÷ servings
  //   - suggestion deltas and added ingredient contributions are whole-recipe, so we ÷ servings
  const numServingsForCalc = servings || 1
  const livePreview = useMemo(() => {
    // Base: per-serving USDA-verified totals from the macro match table
    const base = { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 }
    if (entries) {
      for (const [key, { actual }] of entries) {
        if (key === 'calories') base.calories = actual
        else if (key === 'protein') base.protein = actual
        else if (key === 'fat') base.fat = actual
        else if (key === 'carbohydrates') base.carbs = actual
        else if (key === 'fibre') base.fibre = actual
      }
    }
    console.log(`[PREVIEW] Base per-serving totals:`, base, `(servings: ${numServingsForCalc})`)

    const adjusted = { ...base }

    // Apply slider adjustments from Marco's suggestions
    // delta = sliderValue - original_quantity_g (ALWAYS original, never suggested)
    // whole-recipe macro change = delta_g × (nutrient_per_100g / 100)
    // per-serving macro change = whole-recipe change ÷ servings
    suggestions.forEach((s, i) => {
      if (!s.usda_per_100g || !checked[i]) return
      const per100 = s.usda_per_100g
      const origG = s.original_quantity_g || 0
      const sliderG = quantities[i] || 0
      const deltaG = sliderG - origG
      const wholeRecipeDelta = deltaG / 100
      const perServingDelta = wholeRecipeDelta / numServingsForCalc
      console.log(`[PREVIEW] Suggestion "${s.ingredient}": slider=${sliderG}g, original=${origG}g, suggested=${s.suggested_quantity_g}g, deltaG=${deltaG}g, per100g=`, per100, `perServingDelta factor=${perServingDelta.toFixed(4)}`)
      adjusted.calories += perServingDelta * per100.calories
      adjusted.protein += perServingDelta * per100.protein
      adjusted.fat += perServingDelta * per100.fat
      adjusted.carbs += perServingDelta * per100.carbs
      adjusted.fibre += perServingDelta * per100.fibre
    })

    // Apply ingredient quantity slider changes and removals
    ingredientData.forEach((ing, i) => {
      const kept = ingredientKept.length > i ? ingredientKept[i] : true
      const originalG = parseFloat(ing.amount) || 0
      const currentG = ingredientQuantities[i] !== undefined ? ingredientQuantities[i] : originalG

      if (!kept) {
        // Ingredient removed — subtract its full per-serving contribution
        if (!ing.perServing) return
        adjusted.calories -= ing.perServing.calories
        adjusted.protein -= ing.perServing.protein
        adjusted.fat -= ing.perServing.fat
        adjusted.carbs -= ing.perServing.carbs
        adjusted.fibre -= (ing.perServing.fibre || 0)
        return
      }

      // Ingredient quantity changed via slider — apply delta using USDA per-100g values
      const deltaG = currentG - originalG
      if (deltaG === 0 || !ing.wholeRecipe || !originalG || originalG < 1) return

      // We have whole-recipe USDA nutrients for originalG — scale to get per-100g, then apply delta
      const per100 = {
        calories: (ing.wholeRecipe.calories / originalG) * 100,
        protein:  (ing.wholeRecipe.protein  / originalG) * 100,
        fat:      (ing.wholeRecipe.fat      / originalG) * 100,
        carbs:    (ing.wholeRecipe.carbs    / originalG) * 100,
        fibre:    ((ing.wholeRecipe.fibre || 0) / originalG) * 100,
      }
      const perServingDelta = (deltaG / 100) / numServingsForCalc
      adjusted.calories += perServingDelta * per100.calories
      adjusted.protein  += perServingDelta * per100.protein
      adjusted.fat      += perServingDelta * per100.fat
      adjusted.carbs    += perServingDelta * per100.carbs
      adjusted.fibre    += perServingDelta * per100.fibre
    })

    // Add user-added ingredients — quantity × per100g / 100 = whole-recipe; ÷ servings
    for (const added of addedIngredients) {
      if (!added.checked || !added.usda_per_100g) continue
      const contrib = added.quantity / 100 / numServingsForCalc
      adjusted.calories += contrib * added.usda_per_100g.calories
      adjusted.protein += contrib * added.usda_per_100g.protein
      adjusted.fat += contrib * added.usda_per_100g.fat
      adjusted.carbs += contrib * added.usda_per_100g.carbs
      adjusted.fibre += contrib * added.usda_per_100g.fibre
    }

    console.log(`[PREVIEW] Final per-serving adjusted:`, adjusted)

    return {
      calories: Math.round(adjusted.calories),
      protein: Math.round(adjusted.protein),
      fat: Math.round(adjusted.fat),
      carbs: Math.round(adjusted.carbs),
      fibre: Math.round(adjusted.fibre),
    }
  }, [checked, quantities, suggestions, entries, addedIngredients, ingredientData, ingredientKept, ingredientQuantities, numServingsForCalc])

  // Get targets from macroMatch for colour-coding
  const targets = {}
  if (macroMatch) {
    if (macroMatch.calories) targets.calories = macroMatch.calories.target
    if (macroMatch.protein) targets.protein = macroMatch.protein.target
    if (macroMatch.fat) targets.fat = macroMatch.fat.target
    if (macroMatch.carbohydrates) targets.carbs = macroMatch.carbohydrates.target
    if (macroMatch.fibre) targets.fibre = macroMatch.fibre.target
  }

  const getColor = (actual, target) => {
    if (!target || target === 0) return 'text-slate-400'
    const pct = Math.abs(actual - target) / target
    if (pct <= 0.1) return 'text-green-400'
    if (pct <= 0.2) return 'text-amber-400'
    return 'text-red-400'
  }

  const getBgColor = (actual, target) => {
    if (!target || target === 0) return 'bg-slate-700/30'
    const pct = Math.abs(actual - target) / target
    if (pct <= 0.1) return 'bg-green-900/20 border-green-700/30'
    if (pct <= 0.2) return 'bg-amber-900/20 border-amber-700/30'
    return 'bg-red-900/20 border-red-700/30'
  }

  const handleApply = () => {
    // Build the custom adjustments array for apply
    const adjustments = suggestions
      .map((s, i) => ({
        ...s,
        checked: checked[i],
        custom_quantity_g: quantities[i],
      }))
      .filter(a => a.checked)
    // Include user-added ingredients
    const extras = addedIngredients
      .filter(a => a.checked)
      .map(a => ({
        ingredient: a.ingredient,
        description: a.description,
        original_quantity_g: 0,
        suggested_quantity_g: a.quantity,
        custom_quantity_g: a.quantity,
        usda_per_100g: a.usda_per_100g,
        checked: true,
        isAdded: true,
      }))
    // Collect removed ingredients
    const removedIngredients = ingredientData
      .filter((_, i) => !ingredientKept[i])
      .map(ing => ing.name)

    // Build ingredient quantity overrides for kept ingredients whose slider was moved
    const ingredientOverrides = ingredientData
      .map((ing, i) => ({ ing, i }))
      .filter(({ ing, i }) => {
        if (!ingredientKept[i]) return false
        const originalG = parseFloat(ing.amount) || 0
        const currentG = ingredientQuantities[i] !== undefined ? ingredientQuantities[i] : originalG
        return currentG !== originalG
      })
      .map(({ ing, i }) => ({
        name: ing.name,
        original_quantity_g: parseFloat(ing.amount) || 0,
        new_quantity_g: ingredientQuantities[i],
      }))
    if (onApplyCustomRefined) {
      onApplyCustomRefined([...adjustments, ...extras], removedIngredients, ingredientOverrides)
    } else {
      onApplyRefined()
    }
  }

  // Check if any suggestion has adjustable quantities (non-swap)
  const hasAdjustable = suggestions.some(s => s.original_quantity_g > 0 && s.suggested_quantity_g > 0)

  return (
    <div className="mt-5 space-y-4">
      {/* Ingredient list — deselect to remove */}
      {ingredientData.length > 0 && (
        <div className="bg-navy rounded-xl p-5 border border-navy-lighter/40">
          <h3 className="text-sm font-semibold text-cream mb-1">Ingredients</h3>
          <p className="text-xs text-slate-500 mb-3">Uncheck ingredients you want to remove</p>
          <div className="space-y-2">
            {ingredientData.map((ing, i) => {
              const originalG = parseFloat(ing.amount) || 0
              const kept = ingredientKept.length > i ? ingredientKept[i] : true
              const sliderMax = Math.max(originalG * 2, 50)
              const sliderMin = 0
              return (
                <div
                  key={i}
                  className={`rounded-lg px-3 py-2 transition-all ${kept ? 'bg-navy-light/50' : 'bg-navy-light/20 opacity-40'}`}
                >
                  {/* Top row: checkbox + name + macros */}
                  <div className="flex items-center gap-3">
                    <div
                      onClick={() => toggleIngredientKept(i)}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        kept ? 'bg-gold border-gold' : 'border-slate-600'
                      }`}
                    >
                      {kept && (
                        <svg className="w-2.5 h-2.5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm flex-1 ${!kept ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                      {ing.name}
                    </span>
                    {ing.perServing && (
                      <span className="text-xs text-slate-500 shrink-0">
                        {ing.perServing.calories}cal · {ing.perServing.protein}p · {ing.perServing.fat}f · {ing.perServing.carbs}c
                      </span>
                    )}
                  </div>

                  {/* Slider row — only if ingredient is kept and has USDA data */}
                  {kept && originalG > 0 && (
                    <div className="mt-2 ml-7">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIngredientQuantities(prev => {
                              const next = [...prev]
                              const cur = next[i] !== undefined ? next[i] : originalG
                              next[i] = Math.max(sliderMin, cur - 1)
                              return next
                            })
                          }}
                          className="w-6 h-6 rounded bg-navy-lighter/50 border border-navy-lighter text-slate-300 hover:text-gold hover:border-gold/40 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                        >{'\u2212'}</button>
                        <div className="flex-1">
                          <input
                            type="range"
                            min={sliderMin}
                            max={sliderMax}
                            step={1}
                            value={ingredientQuantities[i] !== undefined ? ingredientQuantities[i] : originalG}
                            onChange={(e) => {
                              const val = Number(e.target.value)
                              setIngredientQuantities(prev => { const next = [...prev]; next[i] = val; return next })
                            }}
                            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                            style={{
                              background: (() => {
                                const cur = ingredientQuantities[i] !== undefined ? ingredientQuantities[i] : originalG
                                const pct = ((cur - sliderMin) / (sliderMax - sliderMin)) * 100
                                return `linear-gradient(to right, #C8A951 0%, #C8A951 ${pct}%, #1e293b ${pct}%, #1e293b 100%)`
                              })()
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIngredientQuantities(prev => {
                              const next = [...prev]
                              const cur = next[i] !== undefined ? next[i] : originalG
                              next[i] = Math.min(sliderMax, cur + 1)
                              return next
                            })
                          }}
                          className="w-6 h-6 rounded bg-navy-lighter/50 border border-navy-lighter text-slate-300 hover:text-gold hover:border-gold/40 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                        >+</button>
                        <span className="text-xs font-medium text-gold min-w-[42px] text-right">
                          {ingredientQuantities[i] !== undefined ? ingredientQuantities[i] : originalG}g
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-navy rounded-xl p-5 border border-gold/25">
      <h3 className="text-base font-semibold text-gold mb-3 flex items-center gap-2">
        <span className="text-lg">👨‍🍳</span>
        Chef Marco's Adjustments
      </h3>

      {/* Suggestion rows with checkboxes and sliders */}
      <div className="space-y-4 mb-5">
        {suggestions.map((suggestion, i) => {
          const hasSlider = suggestion.original_quantity_g > 0 && suggestion.suggested_quantity_g >= 0
          const isReduce = suggestion.suggested_quantity_g < suggestion.original_quantity_g
          const min = isReduce ? 0 : suggestion.original_quantity_g
          const max = isReduce
            ? suggestion.original_quantity_g
            : suggestion.original_quantity_g + 2 * (suggestion.suggested_quantity_g - suggestion.original_quantity_g)
          const step = 1

          return (
            <div key={i} className={`rounded-lg p-3 border transition-all ${checked[i] ? 'border-gold/30 bg-navy-light' : 'border-navy-lighter/30 bg-navy-light/50 opacity-60'}`}>
              {/* Checkbox + description */}
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <div className="mt-0.5 shrink-0">
                  <div
                    onClick={(e) => { e.preventDefault(); toggleCheck(i) }}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                      checked[i] ? 'bg-gold border-gold' : 'border-slate-500 hover:border-slate-400'
                    }`}
                  >
                    {checked[i] && (
                      <svg className="w-3 h-3 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm text-slate-300">{suggestion.description}</span>
              </label>

              {/* Slider for adjustable quantities */}
              {hasSlider && checked[i] && (
                <div className="mt-3 ml-8">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQuantity(i, Math.max(min, quantities[i] - step))}
                      className="w-7 h-7 rounded-md bg-navy-lighter/50 border border-navy-lighter text-slate-300 hover:text-gold hover:border-gold/40 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                    >
                      −
                    </button>
                    <div className="flex-1 relative">
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={quantities[i]}
                        onChange={(e) => setQuantity(i, Number(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer slider-gold"
                        style={{
                          background: `linear-gradient(to right, #C8A951 0%, #C8A951 ${((quantities[i] - min) / (max - min)) * 100}%, #1e293b ${((quantities[i] - min) / (max - min)) * 100}%, #1e293b 100%)`,
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuantity(i, Math.min(max, quantities[i] + step))}
                      className="w-7 h-7 rounded-md bg-navy-lighter/50 border border-navy-lighter text-slate-300 hover:text-gold hover:border-gold/40 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                    >
                      +
                    </button>
                    <span className="text-sm font-medium text-gold min-w-[50px] text-right">{quantities[i]}g</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 mt-1 px-10">
                    <span>{min}g {isReduce ? '(remove)' : '(original)'}</span>
                    <span>{max}g {isReduce ? '(original)' : ''}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Added ingredient cards */}
      {addedIngredients.length > 0 && (
        <div className="space-y-3 mb-5">
          {addedIngredients.map((added, i) => {
            const addedMin = 0
            const addedMax = added.entered_quantity * 2
            const addedStep = 1
            return (
              <div key={`added-${i}`} className={`rounded-lg p-3 border transition-all ${added.checked ? 'border-green-600/40 bg-navy-light' : 'border-navy-lighter/30 bg-navy-light/50 opacity-60'}`}>
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <div className="mt-0.5 shrink-0">
                    <div
                      onClick={(e) => { e.preventDefault(); toggleAddedCheck(i) }}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                        added.checked ? 'bg-green-500 border-green-500' : 'border-slate-500 hover:border-slate-400'
                      }`}
                    >
                      {added.checked && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <span className="text-sm text-slate-300">{added.description}</span>
                    <span className="ml-2 text-xs text-green-400/70 font-medium">Added by you</span>
                  </div>
                </label>
                {added.checked && (
                  <div className="mt-3 ml-8">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setAddedQuantity(i, Math.max(addedMin, added.quantity - addedStep))}
                        className="w-7 h-7 rounded-md bg-navy-lighter/50 border border-navy-lighter text-slate-300 hover:text-green-400 hover:border-green-600/40 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer">−</button>
                      <div className="flex-1">
                        <input type="range" min={addedMin} max={addedMax} step={addedStep} value={added.quantity}
                          onChange={(e) => setAddedQuantity(i, Number(e.target.value))}
                          className="w-full h-2 rounded-full appearance-none cursor-pointer slider-gold"
                          style={{ background: `linear-gradient(to right, #22c55e 0%, #22c55e ${((added.quantity - addedMin) / (addedMax - addedMin)) * 100}%, #1e293b ${((added.quantity - addedMin) / (addedMax - addedMin)) * 100}%, #1e293b 100%)` }}
                        />
                      </div>
                      <button type="button" onClick={() => setAddedQuantity(i, Math.min(addedMax, added.quantity + addedStep))}
                        className="w-7 h-7 rounded-md bg-navy-lighter/50 border border-navy-lighter text-slate-300 hover:text-green-400 hover:border-green-600/40 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer">+</button>
                      <span className="text-sm font-medium text-green-400 min-w-[50px] text-right">{added.quantity}g</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-1 px-10">
                      <span>0g (remove)</span>
                      <span>{addedMax}g</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Ingredient input */}
      <div className="mb-5 bg-navy-light/60 rounded-lg p-4 border border-navy-lighter/30">
        <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-1.5">
          <span className="text-green-400 text-base">+</span>
          Add Ingredient
        </h4>
        <div className="flex gap-2">
          <input
            type="text"
            value={addName}
            onChange={(e) => { setAddName(e.target.value); setAddError(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddIngredient() }}
            placeholder="e.g. quinoa, Greek yoghurt, protein powder..."
            className="flex-1 bg-navy border border-navy-lighter rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-600/40 focus:border-green-600/40"
          />
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={addQuantity}
              onChange={(e) => setAddQuantity(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddIngredient() }}
              placeholder="100"
              min={1}
              className="w-20 bg-navy border border-navy-lighter rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-600/40 focus:border-green-600/40"
            />
            <span className="text-xs text-slate-500">g</span>
          </div>
          <button
            type="button"
            onClick={handleAddIngredient}
            disabled={addLoading || !addName.trim() || !addQuantity}
            className="px-4 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm font-medium border border-green-600/30 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {addLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : 'Add'}
          </button>
        </div>
        {addError && (
          <p className="text-xs text-red-400 mt-2">{addError}</p>
        )}
      </div>

      {/* Live Preview Panel */}
      <div className="bg-navy-light/80 rounded-lg p-4 border border-navy-lighter/40 mb-4">
        <h4 className="text-sm font-semibold text-cream mb-3">Estimated adjusted macros</h4>
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: 'Calories', value: livePreview.calories, unit: 'kcal', target: targets.calories },
            { label: 'Protein', value: livePreview.protein, unit: 'g', target: targets.protein },
            { label: 'Fat', value: livePreview.fat, unit: 'g', target: targets.fat },
            { label: 'Carbs', value: livePreview.carbs, unit: 'g', target: targets.carbs },
            { label: 'Fibre', value: livePreview.fibre, unit: 'g', target: targets.fibre },
          ].map(({ label, value, unit, target }) => (
            <div key={label} className={`rounded-lg p-2 border text-center ${getBgColor(value, target)}`}>
              <p className="text-xs text-slate-400 mb-1">{label}</p>
              <p className={`text-sm font-bold ${getColor(value, target)}`}>{value}{unit}</p>
              {target > 0 && (
                <p className="text-xs text-slate-500 mt-0.5">{target}{unit}</p>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 opacity-60 mt-2">Live estimate — final values verified by USDA after applying</p>
      </div>

      <button
        onClick={handleApply}
        disabled={false}
        className="w-full bg-gold hover:bg-gold-light text-navy font-semibold py-3 px-5 rounded-xl transition-colors cursor-pointer shadow-lg shadow-gold/10 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Apply Changes
      </button>
      </div>
    </div>
  )
}

function MacroMatchDisplay({ macroMatch, macroNotes, usdaNutrition, macroModes, onRefine, refineLoading, refineSuggestions, onApplyRefined, onApplyCustomRefined, recipeIngredients, nutritionDetails, servings }) {
  if (!macroMatch) return null

  const getMatchColor = (target, actual) => {
    if (!target || target === 0) return 'text-slate-400'
    const diff = Math.abs(actual - target) / target
    if (diff <= 0.1) return 'text-green-400'
    if (diff <= 0.2) return 'text-amber-400'
    return 'text-red-400'
  }

  const entries = Object.entries(macroMatch).filter(([, v]) => v.target)
    .map(([key, v]) => {
      const usdaKey = USDA_KEY_MAP[key]
      const usdaValue = usdaNutrition && usdaKey != null ? usdaNutrition[usdaKey] : undefined
      const actual = usdaValue != null ? Math.round(usdaValue) : v.actual
      // Resolve the mode for this macro
      const modeKey = MODE_KEY_MAP[key]
      const mode = (modeKey && macroModes ? macroModes[modeKey] : null) || DEFAULT_MODE[key] || 'exact'
      return [key, { ...v, actual, mode }]
    })

  // Check if any macro is more than 15% off target (only when USDA data is available)
  const hasSignificantMiss = usdaNutrition && entries.some(([, { target, actual }]) => {
    if (!target || target === 0) return false
    return Math.abs(actual - target) / target > 0.15
  })

  return (
    <div className="bg-navy-light rounded-xl p-6 border border-navy-lighter/50">
      <h2 className="text-lg font-semibold text-gold mb-4 flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Macro Match
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-navy-lighter">
              <th className="text-left text-gold/80 font-medium py-2 pr-4">Macro</th>
              <th className="text-right text-gold/80 font-medium py-2 px-4">Target</th>
              <th className="text-right text-gold/80 font-medium py-2 px-4">Actual</th>
              <th className="text-right text-gold/80 font-medium py-2 pl-4">Diff</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([key, { target, actual, unit }]) => {
              const diff = actual - target
              const pctDiff = target > 0 ? ((diff / target) * 100).toFixed(0) : 0
              return (
                <tr key={key} className={`border-b border-navy-lighter/30`}>
                  <td className="py-2.5 pr-4 text-slate-300 capitalize">{key}</td>
                  <td className="py-2.5 px-4 text-right text-cream font-medium">{target} {unit}</td>
                  <td className={`py-2.5 px-4 text-right font-medium ${getMatchColor(target, actual)}`}>
                    {actual} {unit}
                  </td>
                  <td className={`py-2.5 pl-4 text-right font-medium ${getMatchColor(target, actual)}`}>
                    {diff > 0 ? '+' : ''}{pctDiff}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> Within 10%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Within 20%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Over 20%</span>
      </div>
      <p className="text-xs text-slate-500 opacity-60 mt-2">
        {usdaNutrition ? 'Actual values from USDA FoodData Central' : 'Actual values are Chef Marco\'s estimates'}
      </p>

      {usdaNutrition ? (
        <div className="mt-4 space-y-1.5">
          {buildMacroSummary(entries, macroModes).map(({ key, status, label }) => {
            const statusIcon = status === 'good' ? '✅' : status === 'warn' ? '⚠️' : '🔴'
            const statusColor = status === 'good'
              ? 'text-green-400'
              : status === 'warn'
                ? 'text-amber-400'
                : 'text-red-400'
            return (
              <p key={key} className={`text-sm ${statusColor}`}>
                <span className="capitalize font-medium">{key}</span>: {label} {statusIcon}
              </p>
            )
          })}
        </div>
      ) : macroNotes ? (
        <div className="mt-4 p-4 bg-gold/5 rounded-lg border border-gold/15">
          <p className="text-sm text-slate-300">
            <span className="text-gold font-semibold">Chef Marco's note: </span>
            {macroNotes}
          </p>
        </div>
      ) : null}

      {/* Refine Recipe button — shown when any macro is >15% off and USDA data is available */}
      {hasSignificantMiss && onRefine && !refineSuggestions && (
        <button
          onClick={onRefine}
          disabled={refineLoading}
          className="mt-5 w-full bg-gold/15 hover:bg-gold/25 text-gold font-semibold py-3 px-5 rounded-xl transition-colors border border-gold/30 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {refineLoading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Chef Marco is refining...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refine Recipe
            </>
          )}
        </button>
      )}

      {/* Interactive refinement suggestions card */}
      {refineSuggestions && (
        <InteractiveRefinement
          suggestions={refineSuggestions}
          macroMatch={macroMatch}
          usdaNutrition={usdaNutrition}
          entries={entries}
          onApplyRefined={onApplyRefined}
          onApplyCustomRefined={onApplyCustomRefined}
          recipeIngredients={recipeIngredients}
          nutritionDetails={nutritionDetails}
          servings={servings}
        />
      )}
    </div>
  )
}

export { MacroMatchDisplay }

export default function MacroTargets({ onSubmit, loading }) {
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [proteinMode, setProteinMode] = useState('minimum')
  const [carbs, setCarbs] = useState('')
  const [carbsMode, setCarbsMode] = useState('maximum')
  const [fat, setFat] = useState('')
  const [fatMode, setFatMode] = useState('maximum')
  const [fibre, setFibre] = useState('')
  const [fibreMode, setFibreMode] = useState('minimum')
  const [sugar, setSugar] = useState('')
  const [sodium, setSodium] = useState('')
  const [mealStructure, setMealStructure] = useState('all-in-one')
  const [cookingMethod, setCookingMethod] = useState('No preference')
  const [includeIngredients, setIncludeIngredients] = useState('')
  const [excludeIngredients, setExcludeIngredients] = useState('')
  const [servings, setServings] = useState(1)
  const [isMetric, setIsMetric] = useState(true)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      calories: calories ? parseInt(calories) : null,
      protein: protein ? parseInt(protein) : null,
      proteinMode,
      carbs: carbs ? parseInt(carbs) : null,
      carbsMode,
      fat: fat ? parseInt(fat) : null,
      fatMode,
      fibre: fibre ? parseInt(fibre) : null,
      fibreMode,
      sugar: sugar ? parseInt(sugar) : null,
      sodium: sodium ? parseInt(sodium) : null,
      mealStructure,
      cookingMethod,
      includeIngredients: includeIngredients.trim() || null,
      excludeIngredients: excludeIngredients.trim() || null,
      servings,
      units: isMetric ? 'metric' : 'imperial',
    })
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-cream mb-2">
          Macro Targets
        </h1>
        <p className="text-slate-400 text-lg">
          Tell Chef Marco your exact nutritional targets and he'll engineer a recipe to match.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-navy-light rounded-xl p-6 border border-navy-lighter/50 space-y-5">
          {/* Protein */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-cream">Protein (g)</label>
              <MacroToggle value={proteinMode} onChange={setProteinMode} />
            </div>
            <input
              type="number"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              min={0}
              max={500}
              placeholder="e.g. 40"
              className="w-full bg-navy border border-navy-lighter rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
            />
          </div>

          {/* Carbohydrates */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-cream">Carbohydrates (g)</label>
              <MacroToggle value={carbsMode} onChange={setCarbsMode} />
            </div>
            <input
              type="number"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
              min={0}
              max={500}
              placeholder="e.g. 50"
              className="w-full bg-navy border border-navy-lighter rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
            />
          </div>

          {/* Fat */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-cream">Fat (g)</label>
              <MacroToggle value={fatMode} onChange={setFatMode} />
            </div>
            <input
              type="number"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
              min={0}
              max={300}
              placeholder="e.g. 20"
              className="w-full bg-navy border border-navy-lighter rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
            />
          </div>

          {/* Fibre */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-cream">Fibre (g)</label>
              <MacroToggle value={fibreMode} onChange={setFibreMode} />
            </div>
            <input
              type="number"
              value={fibre}
              onChange={(e) => setFibre(e.target.value)}
              min={0}
              max={100}
              placeholder="e.g. 8"
              className="w-full bg-navy border border-navy-lighter rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
            />
          </div>

          {/* Sugar (max only) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-cream">Sugar (g)</label>
              <span className="text-xs text-slate-500 bg-navy-lighter px-2 py-1 rounded-md">maximum</span>
            </div>
            <input
              type="number"
              value={sugar}
              onChange={(e) => setSugar(e.target.value)}
              min={0}
              max={200}
              placeholder="e.g. 10"
              className="w-full bg-navy border border-navy-lighter rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
            />
          </div>

          {/* Sodium (max only) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-cream">Sodium (mg)</label>
              <span className="text-xs text-slate-500 bg-navy-lighter px-2 py-1 rounded-md">maximum</span>
            </div>
            <input
              type="number"
              value={sodium}
              onChange={(e) => setSodium(e.target.value)}
              min={0}
              max={5000}
              placeholder="e.g. 600"
              className="w-full bg-navy border border-navy-lighter rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
            />
          </div>
        </div>

        {/* Meal options */}
        <div className="bg-navy-light rounded-xl p-6 border border-navy-lighter/50 space-y-5">
          {/* Meal Structure */}
          <div>
            <label className="block text-sm font-medium text-cream mb-2">Meal structure</label>
            <div className="flex bg-navy rounded-lg border border-navy-lighter p-1">
              <button
                type="button"
                onClick={() => setMealStructure('all-in-one')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all cursor-pointer ${
                  mealStructure === 'all-in-one'
                    ? 'bg-gold text-navy shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All in one
              </button>
              <button
                type="button"
                onClick={() => setMealStructure('main-plus-sides')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all cursor-pointer ${
                  mealStructure === 'main-plus-sides'
                    ? 'bg-gold text-navy shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Main + sides
              </button>
            </div>
          </div>

          {/* Cooking Method */}
          <div>
            <label className="block text-sm font-medium text-cream mb-2">Cooking method</label>
            <select
              value={cookingMethod}
              onChange={(e) => setCookingMethod(e.target.value)}
              className="w-full bg-navy border border-navy-lighter rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 appearance-none cursor-pointer"
            >
              {COOKING_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Include ingredients */}
          <div>
            <label className="block text-sm font-medium text-cream mb-2">
              Ingredients to include <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <textarea
              value={includeIngredients}
              onChange={(e) => setIncludeIngredients(e.target.value)}
              placeholder="e.g. chicken breast, brown rice, broccoli..."
              rows={2}
              className="w-full bg-navy border border-navy-lighter rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 resize-none"
            />
          </div>

          {/* Exclude ingredients */}
          <div>
            <label className="block text-sm font-medium text-cream mb-2">
              Ingredients to exclude <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <textarea
              value={excludeIngredients}
              onChange={(e) => setExcludeIngredients(e.target.value)}
              placeholder="e.g. nuts, shellfish, dairy..."
              rows={2}
              className="w-full bg-navy border border-navy-lighter rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 resize-none"
            />
          </div>

          {/* Servings & units row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-cream mb-2">Servings</label>
              <input
                type="number"
                min={1}
                max={20}
                value={servings}
                onChange={(e) => setServings(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                className="w-24 bg-navy border border-navy-lighter rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-cream mb-2">Measurements</label>
              <div className="flex bg-navy rounded-lg border border-navy-lighter p-1">
                <button
                  type="button"
                  onClick={() => setIsMetric(true)}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all cursor-pointer ${
                    isMetric ? 'bg-gold text-navy shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Metric
                </button>
                <button
                  type="button"
                  onClick={() => setIsMetric(false)}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all cursor-pointer ${
                    !isMetric ? 'bg-gold text-navy shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Imperial
                </button>
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gold hover:bg-gold-light text-navy font-semibold py-4 px-6 rounded-xl transition-colors text-lg shadow-lg shadow-gold/10 cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Chef Marco is engineering your meal...' : 'Engineer My Meal'}
        </button>
        <p className="text-xs text-slate-500 opacity-60 text-center mt-3">
          Chef Marco AI will aim to match your macro targets. Actual nutritional values may vary. This feature is not a substitute for advice from a qualified dietitian or medical practitioner.
        </p>
      </form>
    </div>
  )
}
