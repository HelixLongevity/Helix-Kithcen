import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './components/AuthContext'
import RecipeForm from './components/RecipeForm'
import RecipeDisplay from './components/RecipeDisplay'
import Loading from './components/Loading'
import HelixLogo from './components/HelixLogo'
import PrintView from './components/PrintView'
import Favourites from './components/Favourites'
import MealPlanner from './components/MealPlanner'
import MacroTargets, { MacroMatchDisplay } from './components/MacroTargets'
import DishRequest from './components/DishRequest'
import PricingPage from './components/PricingPage'
import AccountPage from './components/AccountPage'
import UpgradePrompt from './components/UpgradePrompt'
import LoginPage from './components/LoginPage'
import RegisterPage from './components/RegisterPage'
import FeedbackModal from './components/FeedbackModal'
import HelpTips from './components/HelpTips'

function loadFavourites() {
  try {
    return JSON.parse(localStorage.getItem('helix-favourites') || '[]')
  } catch {
    return []
  }
}

function saveFavourites(favs) {
  localStorage.setItem('helix-favourites', JSON.stringify(favs))
}

function loadMealPlan() {
  try {
    const raw = JSON.parse(localStorage.getItem('helix-meal-plan') || '{}')
    // Migrate old format: { Monday: recipe } → { Monday: { dinner: recipe } }
    const migrated = {}
    for (const [day, val] of Object.entries(raw)) {
      if (val && typeof val === 'object' && !val.title) {
        // Already new format (object with slot keys, no title means it's a slot map)
        migrated[day] = val
      } else if (val && val.title) {
        // Old format — single recipe, assign to dinner
        migrated[day] = { dinner: val }
      } else {
        migrated[day] = val
      }
    }
    return migrated
  } catch {
    return {}
  }
}

function saveMealPlan(plan) {
  localStorage.setItem('helix-meal-plan', JSON.stringify(plan))
}

// Feature access rules by tier
const TIER_ACCESS = {
  starter: ['recipes', 'favourites'],
  kitchen: ['recipes', 'favourites', 'planner'],
  performance: ['recipes', 'favourites', 'planner', 'macros', 'dish-request'],
}

function canAccess(tier, feature) {
  if (!tier) return false
  return (TIER_ACCESS[tier] || []).includes(feature)
}

// Map macro_match keys to USDA nutrition field names (mirrors MacroTargets.jsx)
const USDA_KEY_MAP = {
  calories: 'calories',
  protein: 'protein_g',
  carbohydrates: 'carbohydrates_g',
  fat: 'total_fat_g',
  fibre: 'fibre_g',
  sugar: 'sugar_g',
  sodium: 'sodium_mg',
}

function isMacroOff(macroMatch, nutritionData, threshold) {
  if (!macroMatch || !nutritionData) return false
  return Object.entries(macroMatch).some(([key, v]) => {
    if (!v.target || v.target === 0) return false
    const usdaKey = USDA_KEY_MAP[key]
    const usdaValue = usdaKey != null ? nutritionData[usdaKey] : undefined
    const actual = usdaValue != null ? Math.round(usdaValue) : v.actual
    return Math.abs(actual - v.target) / v.target > threshold
  })
}

function AppContent() {
  const {
    user, token, loading: authLoading, subscription, login, register,
    logout, refreshUser, authFetch, isSubscribed, tier,
  } = useAuth()

  const [authView, setAuthView] = useState('login') // 'login' | 'register'
  const [showPricing, setShowPricing] = useState(false)
  const [tab, setTab] = useState('recipes')
  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [favourites, setFavourites] = useState(loadFavourites)
  const [mealPlan, setMealPlan] = useState(loadMealPlan)
  const [syncLoaded, setSyncLoaded] = useState(false)
  const [printRecipe, setPrintRecipe] = useState(null)
  const [macroRecipe, setMacroRecipe] = useState(null)
  const [macroFormData, setMacroFormData] = useState(null)
  const [macroUsdaNutrition, setMacroUsdaNutrition] = useState(null)
  const [macroNutritionFull, setMacroNutritionFull] = useState(null)
  const [macroLoading, setMacroLoading] = useState(false)
  const [macroError, setMacroError] = useState(null)
  const [refineLoading, setRefineLoading] = useState(false)
  const [refineSuggestions, setRefineSuggestions] = useState(null)
  const [refinedRecipe, setRefinedRecipe] = useState(null)
  const [macroLoadingMessage, setMacroLoadingMessage] = useState(null)
  const [autoRefined, setAutoRefined] = useState(false)
  const [dishRecipe, setDishRecipe] = useState(null)
  const [dishLoading, setDishLoading] = useState(false)
  const [dishError, setDishError] = useState(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  // Load favourites & meal plan from server when user logs in
  useEffect(() => {
    if (!token || !user) {
      setSyncLoaded(false)
      return
    }
    let cancelled = false
    const loadFromServer = async () => {
      try {
        const [favRes, planRes] = await Promise.all([
          authFetch('/api/favourites'),
          authFetch('/api/meal-plan'),
        ])
        if (cancelled) return
        if (favRes.ok) {
          const favData = await favRes.json()
          if (favData.favourites && favData.favourites.length > 0) {
            setFavourites(favData.favourites)
            saveFavourites(favData.favourites)
          } else {
            // Server has no favourites — push localStorage ones up if any
            const local = loadFavourites()
            if (local.length > 0) {
              await authFetch('/api/favourites', {
                method: 'PUT',
                body: JSON.stringify({ favourites: local }),
              })
            }
          }
        }
        if (planRes.ok) {
          const planData = await planRes.json()
          if (planData.mealPlan && Object.keys(planData.mealPlan).length > 0) {
            setMealPlan(planData.mealPlan)
            saveMealPlan(planData.mealPlan)
          } else {
            // Server has no meal plan — push localStorage one up if any
            const local = loadMealPlan()
            if (Object.keys(local).length > 0) {
              await authFetch('/api/meal-plan', {
                method: 'PUT',
                body: JSON.stringify({ mealPlan: local }),
              })
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load from server, using localStorage:', err)
      }
      if (!cancelled) setSyncLoaded(true)
    }
    loadFromServer()
    return () => { cancelled = true }
  }, [token, user])

  // Save favourites — localStorage + server
  useEffect(() => {
    saveFavourites(favourites)
    if (token && syncLoaded) {
      authFetch('/api/favourites', {
        method: 'PUT',
        body: JSON.stringify({ favourites }),
      }).catch(() => {})
    }
  }, [favourites])

  // Save meal plan — localStorage + server
  useEffect(() => {
    saveMealPlan(mealPlan)
    if (token && syncLoaded) {
      authFetch('/api/meal-plan', {
        method: 'PUT',
        body: JSON.stringify({ mealPlan }),
      }).catch(() => {})
    }
  }, [mealPlan])

  // Show pricing page if not logged in
  if (authLoading) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (!user) {
    if (showPricing || authView === 'pricing') {
      return (
        <PricingPage
          onLogin={login}
          onRegister={register}
          isLoggedIn={false}
          authFetch={authFetch}
          onSubscribed={() => { refreshUser(); setShowPricing(false) }}
          onShowLogin={() => { setShowPricing(false); setAuthView('login') }}
        />
      )
    }
    if (authView === 'register') {
      return (
        <RegisterPage
          onRegister={async (name, email, password) => {
            await register(name, email, password)
            setShowPricing(true)
          }}
          onSwitchToLogin={() => setAuthView('login')}
        />
      )
    }
    return (
      <LoginPage
        onLogin={async (email, password) => {
          await login(email, password)
        }}
        onSwitchToRegister={() => setAuthView('register')}
      />
    )
  }

  // User is logged in but no active subscription — show pricing
  if (!isSubscribed) {
    return (
      <PricingPage
        onLogin={login}
        onRegister={register}
        isLoggedIn={true}
        authFetch={authFetch}
        onSubscribed={() => refreshUser()}
        onShowLogin={() => { logout() }}
      />
    )
  }

  // --- Authenticated & subscribed app ---

  const TABS = [
    { id: 'recipes', label: 'Recipes' },
    { id: 'favourites', label: 'Favourites' },
    { id: 'planner', label: 'Meal Planner' },
    { id: 'macros', label: 'Macro Targets' },
    { id: 'dish-request', label: 'Dish Request' },
    { id: 'account', label: 'Account' },
  ]

  const handleSubmit = async (formData) => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/recipe', {
        method: 'POST',
        body: JSON.stringify(formData),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to generate recipe')
      }
      const data = await res.json()
      setRecipe(data)
      refreshUser() // refresh recipe count
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleMacroSubmit = async (formData) => {
    setMacroLoading(true)
    setMacroError(null)
    setMacroFormData(formData)
    setMacroLoadingMessage('Chef Marco is engineering your recipe...')
    setAutoRefined(false)
    try {
      const res = await authFetch('/api/macro-recipe', {
        method: 'POST',
        body: JSON.stringify(formData),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to generate macro recipe')
      }
      const data = await res.json()
      setMacroRecipe(data)
      refreshUser()
    } catch (err) {
      setMacroError(err.message)
    } finally {
      setMacroLoading(false)
    }
  }

  const handleNewRecipe = () => {
    setRecipe(null)
    setError(null)
  }

  const handleNewMacroRecipe = () => {
    setMacroRecipe(null)
    setMacroFormData(null)
    setMacroUsdaNutrition(null)
    setMacroNutritionFull(null)
    setMacroError(null)
    setRefineSuggestions(null)
    setRefinedRecipe(null)
    setAutoRefined(false)
    setMacroLoadingMessage(null)
  }

  const handleMacroNutritionData = async (nutritionData, fullResponse) => {
    setMacroUsdaNutrition(nutritionData)
    if (fullResponse) setMacroNutritionFull(fullResponse)

    // Auto-refine: if not already attempted, check if any macro is >20% off
    if (autoRefined || !macroRecipe || !macroFormData || !nutritionData) return
    if (!isMacroOff(macroRecipe.macro_match, nutritionData, 0.20)) return

    // Trigger auto-refinement behind the scenes
    setAutoRefined(true)
    setMacroLoadingMessage('Fine-tuning to hit your targets...')
    setMacroLoading(true)
    setMacroUsdaNutrition(null)

    const currentRecipe = macroRecipe
    setMacroRecipe(null)

    try {
      const allIngredients = (currentRecipe.meal_components || [{ ingredients: currentRecipe.ingredients }])
        .flatMap(c => c.ingredients || [])
      const res = await authFetch('/api/refine-macros', {
        method: 'POST',
        body: JSON.stringify({
          ingredients: allIngredients,
          targetMacros: currentRecipe.macro_match,
          actualMacros: nutritionData,
          macroModes: {
            protein: macroFormData.proteinMode,
            carbs: macroFormData.carbsMode,
            fat: macroFormData.fatMode,
            fibre: macroFormData.fibreMode,
          },
          servings: currentRecipe.servings || 1,
          units: currentRecipe.units || 'metric',
        }),
      })
      if (!res.ok) throw new Error('Auto-refine failed')
      const data = await res.json()
      setMacroRecipe(data.revised_recipe || currentRecipe)
    } catch (err) {
      console.error('Auto-refine error:', err)
      setMacroRecipe(currentRecipe) // Fall back to original
    } finally {
      setMacroLoading(false)
    }
  }

  const handleRefineMacros = async () => {
    if (!macroRecipe || !macroUsdaNutrition) return
    setRefineLoading(true)
    try {
      const allIngredients = (macroRecipe.meal_components || [{ ingredients: macroRecipe.ingredients }])
        .flatMap(c => c.ingredients || [])
      const res = await authFetch('/api/refine-macros', {
        method: 'POST',
        body: JSON.stringify({
          ingredients: allIngredients,
          targetMacros: macroRecipe.macro_match,
          actualMacros: macroUsdaNutrition,
          macroModes: macroFormData ? {
            protein: macroFormData.proteinMode,
            carbs: macroFormData.carbsMode,
            fat: macroFormData.fatMode,
            fibre: macroFormData.fibreMode,
          } : {},
          servings: macroRecipe.servings || 1,
          units: macroRecipe.units || 'metric',
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to refine recipe')
      }
      const data = await res.json()
      setRefineSuggestions(data.suggestions || [])
      setRefinedRecipe(data.revised_recipe || null)
    } catch (err) {
      console.error('Refine error:', err)
      setRefineSuggestions(['Could not refine recipe. Please try again.'])
    } finally {
      setRefineLoading(false)
    }
  }

  const handleApplyRefined = () => {
    if (!refinedRecipe) return
    setMacroRecipe(refinedRecipe)
    setMacroUsdaNutrition(null)
    setRefineSuggestions(null)
    setRefinedRecipe(null)
  }

  const handleApplyCustomRefined = (adjustments, removedIngredients = []) => {
    if (!macroRecipe) return
    const baseRecipe = refinedRecipe || macroRecipe
    const modified = JSON.parse(JSON.stringify(baseRecipe))
    const components = modified.meal_components || [{ ingredients: modified.ingredients }]

    // Build a map of ingredient quantity changes: ingredient name → { oldAmount, newAmount }
    const quantityChanges = {}
    for (const adj of adjustments) {
      if (adj.isAdded || !adj.ingredient) continue
      quantityChanges[adj.ingredient.toLowerCase()] = {
        oldAmount: String(adj.original_quantity_g || ''),
        newAmount: String(adj.custom_quantity_g),
      }
    }

    // Build set of removed ingredient names (lowercased)
    const removedSet = new Set(removedIngredients.map(r => r.toLowerCase()))

    // 1. Update ingredient lists in each component
    for (const comp of components) {
      if (!comp.ingredients) continue
      // Filter out removed ingredients and apply quantity changes
      comp.ingredients = comp.ingredients
        .filter(ing => !removedSet.has((ing.name || '').toLowerCase()))
        .map(ing => {
          const ingLower = (ing.name || '').toLowerCase()
          // Check if any adjustment matches this ingredient
          for (const [adjName, change] of Object.entries(quantityChanges)) {
            if (ingLower.includes(adjName) || adjName.includes(ingLower)) {
              return { ...ing, amount: change.newAmount, unit: 'g' }
            }
          }
          return ing
        })
    }

    // 2. Add user-added ingredients to the first component
    for (const adj of adjustments) {
      if (!adj.isAdded) continue
      if (components[0] && components[0].ingredients) {
        components[0].ingredients.push({ amount: String(adj.custom_quantity_g), unit: 'g', name: adj.ingredient })
      }
    }

    // 3. Update step text: replace old quantities with new, handle removed ingredients
    for (const comp of components) {
      if (!comp.steps) continue
      comp.steps = comp.steps
        .map(step => {
          let text = step.instruction || ''
          // Replace quantity references for changed ingredients
          for (const [adjName, change] of Object.entries(quantityChanges)) {
            if (!change.oldAmount) continue
            // Match patterns like "200g chicken breast", "200 g chicken breast"
            const escaped = adjName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const oldAmtPattern = new RegExp(
              `\\b${change.oldAmount}\\s*g\\b(\\s+(?:of\\s+)?${escaped})`,
              'gi'
            )
            text = text.replace(oldAmtPattern, `${change.newAmount}g$1`)
          }
          // Remove references to removed ingredients from step text
          for (const removed of removedSet) {
            const escaped = removed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            // Remove patterns like ", add the butter" or "and the butter"
            text = text.replace(new RegExp(`[,;]?\\s*(?:and\\s+)?(?:add\\s+)?(?:the\\s+)?\\d*\\s*g?\\s*(?:of\\s+)?${escaped}`, 'gi'), '')
          }
          return { ...step, instruction: text.trim() }
        })
        .filter(step => {
          // Remove steps that ONLY referenced a removed ingredient
          const text = (step.instruction || '').toLowerCase()
          if (!text || text.length < 5) return false
          // Check if the step is now empty or only has a removed ingredient reference
          return true
        })

      // 4. Append steps for added ingredients
      for (const adj of adjustments) {
        if (!adj.isAdded) continue
        comp.steps.push({
          title: `Add ${adj.ingredient}`,
          instruction: `Add ${adj.custom_quantity_g}g ${adj.ingredient} as desired.`,
          timer_seconds: null,
        })
      }
    }

    // Apply the modified recipe — USDA lookup will run automatically via RecipeDisplay
    setMacroRecipe(modified)
    setMacroUsdaNutrition(null)
    setMacroNutritionFull(null)
    setRefineSuggestions(null)
    setRefinedRecipe(null)
  }

  const handleDishSubmit = async (formData) => {
    setDishLoading(true)
    setDishError(null)
    try {
      const res = await authFetch('/api/dish-request', {
        method: 'POST',
        body: JSON.stringify(formData),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to generate recipe')
      }
      const data = await res.json()
      setDishRecipe(data)
      refreshUser()
    } catch (err) {
      setDishError(err.message)
    } finally {
      setDishLoading(false)
    }
  }

  const handleNewDishRecipe = () => {
    setDishRecipe(null)
    setDishError(null)
  }

  const isFavourite = recipe
    ? favourites.some((f) => f.title === recipe.title && f.description === recipe.description)
    : false

  const toggleFavourite = () => {
    if (!recipe) return
    if (isFavourite) {
      setFavourites((prev) => prev.filter((f) => !(f.title === recipe.title && f.description === recipe.description)))
    } else {
      const fav = { ...recipe, _favId: Date.now().toString() }
      setFavourites((prev) => [...prev, fav])
    }
  }

  const removeFavourite = (favId) => {
    setFavourites((prev) => prev.filter((f) => f._favId !== favId))
  }

  const viewFavourite = (fav) => {
    setRecipe(fav)
    setTab('recipes')
  }

  const updateMealPlan = (day, slot, recipe) => {
    setMealPlan((prev) => {
      const daySlots = prev[day] || {}
      if (recipe === null) {
        const updated = { ...daySlots }
        delete updated[slot]
        return { ...prev, [day]: updated }
      }
      return { ...prev, [day]: { ...daySlots, [slot]: recipe } }
    })
  }

  const handleGenerateForDay = async (day, slot, formData) => {
    const res = await authFetch('/api/recipe', {
      method: 'POST',
      body: JSON.stringify(formData),
    })
    if (!res.ok) throw new Error('Failed to generate')
    const data = await res.json()
    setMealPlan((prev) => {
      const daySlots = prev[day] || {}
      return { ...prev, [day]: { ...daySlots, [slot]: data } }
    })
    setFavourites((prev) => {
      const exists = prev.some((f) => f.title === data.title && f.description === data.description)
      if (exists) return prev
      return [...prev, { ...data, _favId: Date.now().toString() }]
    })
    refreshUser()
  }

  const viewPlannerRecipe = (r) => {
    setRecipe(r)
    setTab('recipes')
  }

  const handlePrint = () => {
    if (recipe) setPrintRecipe(recipe)
  }

  // Recipe limit display for starter
  const recipeCount = subscription?.recipesGeneratedThisMonth || 0
  const recipeLimit = subscription?.recipeLimit
  const atLimit = recipeLimit && recipeCount >= recipeLimit

  return (
    <div className="min-h-screen bg-navy">
      {printRecipe && (
        <PrintView recipe={printRecipe} onClose={() => setPrintRecipe(null)} />
      )}
      {showFeedback && (
        <FeedbackModal onClose={() => setShowFeedback(false)} />
      )}
      {showHelp && (
        <HelpTips onClose={() => setShowHelp(false)} />
      )}

      <header className="border-b border-navy-lighter/50 bg-navy/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <HelixLogo />
          <div className="flex items-center gap-3">
            {recipeLimit && (
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                atLimit ? 'bg-red-900/30 text-red-300 border border-red-700/40' : 'bg-gold/10 text-gold border border-gold/20'
              }`}>
                {recipeCount}/{recipeLimit} recipes
              </span>
            )}
            {recipe && tab === 'recipes' && (
              <button
                onClick={handleNewRecipe}
                className="text-sm font-medium text-gold hover:text-gold-light transition-colors cursor-pointer"
              >
                + New Recipe
              </button>
            )}
            {macroRecipe && tab === 'macros' && (
              <button
                onClick={handleNewMacroRecipe}
                className="text-sm font-medium text-gold hover:text-gold-light transition-colors cursor-pointer"
              >
                + New Macro Recipe
              </button>
            )}
            {dishRecipe && tab === 'dish-request' && (
              <button
                onClick={handleNewDishRecipe}
                className="text-sm font-medium text-gold hover:text-gold-light transition-colors cursor-pointer"
              >
                + New Dish Request
              </button>
            )}
            <div className="relative ml-2">
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gold/30 bg-gold/5 hover:bg-gold/15 text-gold text-xs font-medium transition-colors cursor-pointer"
                title="Menu"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 3.5h10M2 7h10M2 10.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Menu
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-30 bg-navy-light border border-navy-lighter/60 rounded-xl shadow-xl min-w-[180px] py-1 overflow-hidden">
                    <button
                      onClick={() => { setShowHelp(true); setShowMenu(false) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-cream hover:bg-navy-lighter/40 transition-colors cursor-pointer text-left"
                    >
                      <span className="text-base opacity-70">💡</span>
                      Help & Tips
                    </button>
                    <button
                      onClick={() => { setShowFeedback(true); setShowMenu(false) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-cream hover:bg-navy-lighter/40 transition-colors cursor-pointer text-left"
                    >
                      <span className="text-base opacity-70">💬</span>
                      Feedback
                    </button>
                    <div className="border-t border-navy-lighter/40 my-1" />
                    <button
                      onClick={() => { logout(); setShowMenu(false) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-navy-lighter/40 transition-colors cursor-pointer text-left"
                    >
                      <span className="text-base opacity-70">🚪</span>
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
                  tab === t.id
                    ? 'border-gold text-gold'
                    : 'border-transparent text-slate-400 hover:text-cream hover:border-navy-lighter'
                }`}
              >
                {t.label}
                {t.id === 'favourites' && favourites.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-gold/15 text-gold">
                    {favourites.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {tab === 'recipes' && (
          <>
            {loading ? (
              <Loading />
            ) : recipe ? (
              <RecipeDisplay
                recipe={recipe}
                onNewRecipe={handleNewRecipe}
                isFavourite={isFavourite}
                onToggleFavourite={toggleFavourite}
                onPrint={handlePrint}
              />
            ) : (
              <>
                <div className="text-center mb-8">
                  <h1 className="text-3xl sm:text-4xl font-bold text-cream mb-2">
                    What's cooking tonight?
                  </h1>
                  <p className="text-slate-400 text-lg">
                    Tell Chef Marco what you've got, and he'll craft something brilliant.
                  </p>
                </div>
                {error && (
                  <div className="mb-6 p-4 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
                    {error}
                  </div>
                )}
                {atLimit ? (
                  <div className="text-center py-12">
                    <div className="bg-navy-light rounded-2xl p-8 border border-gold/20 max-w-md mx-auto">
                      <h2 className="text-xl font-bold text-cream mb-2">Monthly limit reached</h2>
                      <p className="text-slate-400 mb-4">
                        You've used all {recipeLimit} recipes this month on the Starter plan.
                      </p>
                      <button
                        onClick={() => setTab('account')}
                        className="bg-gold hover:bg-gold-light text-navy font-semibold py-3 px-6 rounded-xl transition-colors cursor-pointer"
                      >
                        Upgrade for Unlimited Recipes
                      </button>
                    </div>
                  </div>
                ) : (
                  <RecipeForm onSubmit={handleSubmit} />
                )}
              </>
            )}
          </>
        )}

        {tab === 'favourites' && (
          <Favourites
            favourites={favourites}
            onRemove={removeFavourite}
            onView={viewFavourite}
          />
        )}

        {tab === 'planner' && (
          canAccess(tier, 'planner') ? (
            <MealPlanner
              plan={mealPlan}
              onUpdatePlan={updateMealPlan}
              favourites={favourites}
              onGenerateRecipe={handleGenerateForDay}
              onViewRecipe={viewPlannerRecipe}
              tier={tier}
              onUpgrade={() => setTab('account')}
            />
          ) : (
            <UpgradePrompt
              feature="Meal Planner"
              requiredTier="kitchen"
              onUpgrade={() => setTab('account')}
            />
          )
        )}

        {tab === 'macros' && (
          canAccess(tier, 'macros') ? (
            <>
              {macroLoading ? (
                <Loading
                  message={macroLoadingMessage || 'Chef Marco is engineering your recipe...'}
                  submessage={autoRefined ? 'Almost there...' : 'This usually takes 10–20 seconds'}
                />
              ) : macroRecipe ? (
                <div className="space-y-6 animate-fade-in">
                  <RecipeDisplay
                    recipe={macroRecipe}
                    onNewRecipe={handleNewMacroRecipe}
                    isFavourite={favourites.some(f => f.title === macroRecipe.title && f.description === macroRecipe.description)}
                    onToggleFavourite={() => {
                      const exists = favourites.some(f => f.title === macroRecipe.title && f.description === macroRecipe.description)
                      if (exists) {
                        setFavourites(prev => prev.filter(f => !(f.title === macroRecipe.title && f.description === macroRecipe.description)))
                      } else {
                        setFavourites(prev => [...prev, { ...macroRecipe, _favId: Date.now().toString() }])
                      }
                    }}
                    onPrint={() => setPrintRecipe(macroRecipe)}
                    onNutritionData={handleMacroNutritionData}
                  />
                  <MacroMatchDisplay
                    macroMatch={macroRecipe.macro_match}
                    macroNotes={macroRecipe.macro_notes}
                    usdaNutrition={macroUsdaNutrition}
                    macroModes={macroFormData}
                    onRefine={handleRefineMacros}
                    refineLoading={refineLoading}
                    refineSuggestions={refineSuggestions}
                    onApplyRefined={handleApplyRefined}
                    onApplyCustomRefined={handleApplyCustomRefined}
                    recipeIngredients={(macroRecipe.meal_components || []).flatMap(c => c.ingredients || [])}
                    nutritionDetails={macroNutritionFull?.details || null}
                    servings={macroRecipe.servings || 1}
                  />
                </div>
              ) : (
                <>
                  {macroError && (
                    <div className="mb-6 p-4 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
                      {macroError}
                    </div>
                  )}
                  <MacroTargets onSubmit={handleMacroSubmit} loading={macroLoading} />
                </>
              )}
            </>
          ) : (
            <UpgradePrompt
              feature="Macro Targets"
              requiredTier="performance"
              onUpgrade={() => setTab('account')}
            />
          )
        )}

        {tab === 'dish-request' && (
          canAccess(tier, 'dish-request') ? (
            <>
              {dishLoading ? (
                <Loading />
              ) : dishRecipe ? (
                <div className="space-y-6 animate-fade-in">
                  <RecipeDisplay
                    recipe={dishRecipe}
                    onNewRecipe={handleNewDishRecipe}
                    isFavourite={favourites.some(f => f.title === dishRecipe.title && f.description === dishRecipe.description)}
                    onToggleFavourite={() => {
                      const exists = favourites.some(f => f.title === dishRecipe.title && f.description === dishRecipe.description)
                      if (exists) {
                        setFavourites(prev => prev.filter(f => !(f.title === dishRecipe.title && f.description === dishRecipe.description)))
                      } else {
                        setFavourites(prev => [...prev, { ...dishRecipe, _favId: Date.now().toString() }])
                      }
                    }}
                    onPrint={() => setPrintRecipe(dishRecipe)}
                  />
                </div>
              ) : (
                <>
                  <div className="text-center mb-8">
                    <h1 className="text-3xl sm:text-4xl font-bold text-cream mb-2">
                      What do you feel like?
                    </h1>
                    <p className="text-slate-400 text-lg">
                      Describe any dish and Chef Marco will craft the perfect recipe.
                    </p>
                  </div>
                  {dishError && (
                    <div className="mb-6 p-4 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
                      {dishError}
                    </div>
                  )}
                  <DishRequest onSubmit={handleDishSubmit} />
                </>
              )}
            </>
          ) : (
            <UpgradePrompt
              feature="Dish Request"
              requiredTier="performance"
              onUpgrade={() => setTab('account')}
            />
          )
        )}

        {tab === 'account' && (
          <AccountPage
            user={user}
            subscription={subscription}
            authFetch={authFetch}
            onRefresh={refreshUser}
            onLogout={logout}
          />
        )}
      </main>

      <footer className="border-t border-navy-lighter/30 mt-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 text-center text-slate-500 text-xs opacity-60 leading-relaxed">
          Chef Marco is an AI-powered culinary assistant. Recipes and nutritional information are AI-generated estimates only. Use of this app does not constitute medical advice. Consult a qualified medical practitioner or dietitian for personalised guidance. &middot; Helix Longevity
        </div>
      </footer>
    </div>
  )
}

function App() {
  return <AppContent />
}

export default App
