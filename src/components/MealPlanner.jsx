import { useState, useMemo } from 'react'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const COOKING_METHODS = [
  'No preference',
  'Stove top',
  'Oven',
  'Slow cooker',
  'BBQ',
  'Microwave',
]

const NUTRITION_MODES = [
  'Balanced',
  'Low Fat',
  'High Fibre',
  'Low Sugar',
  'Low Carb',
  'High Protein',
  'Full Flavour',
]

const EXCLUSIVE_MODES = ['Balanced', 'Full Flavour']

const KNOWN_PROTEINS = [
  'chicken', 'salmon', 'beef', 'lamb', 'tofu', 'pork', 'turkey', 'prawns',
  'shrimp', 'tuna', 'cod', 'duck', 'venison', 'veal', 'tempeh', 'seitan',
  'eggs', 'fish', 'mince', 'steak', 'thigh', 'breast', 'fillet', 'sausage',
  'bacon', 'chorizo', 'halloumi', 'paneer', 'chickpeas', 'lentils', 'beans',
]

const INGREDIENT_CATEGORIES = {
  Proteins: ['chicken', 'salmon', 'beef', 'lamb', 'tofu', 'pork', 'turkey', 'prawns', 'shrimp', 'tuna', 'cod', 'duck', 'venison', 'veal', 'tempeh', 'seitan', 'eggs', 'egg', 'fish', 'mince', 'steak', 'thigh', 'breast', 'fillet', 'sausage', 'bacon', 'chorizo', 'halloumi', 'paneer', 'chickpeas', 'chickpea', 'lentils', 'lentil', 'beans', 'bean', 'kangaroo', 'bison', 'silverside', 'oyster blade', 'scotch fillet', 'rump', 'sirloin', 'protein powder', 'edamame'],
  Dairy: ['milk', 'cream', 'cheese', 'butter', 'yoghurt', 'yogurt', 'creme', 'sour cream', 'parmesan', 'mozzarella', 'cheddar', 'ricotta', 'feta', 'mascarpone', 'ghee', 'almond butter', 'tahini', 'peanut butter'],
  Fruit: ['apple', 'banana', 'orange', 'berry', 'berries', 'raspberry', 'raspberries', 'blueberry', 'blueberries', 'strawberry', 'strawberries', 'mango', 'pineapple', 'watermelon', 'grape', 'grapes', 'pear', 'peach', 'plum', 'kiwi', 'passionfruit', 'dates', 'date', 'medjool', 'fig', 'figs', 'pomegranate', 'cherry', 'cherries', 'cranberry', 'cranberries'],
  Vegetables: ['onion', 'garlic', 'tomato', 'potato', 'carrot', 'capsicum', 'pepper', 'zucchini', 'broccoli', 'spinach', 'kale', 'mushroom', 'celery', 'leek', 'cabbage', 'corn', 'peas', 'asparagus', 'eggplant', 'cauliflower', 'lettuce', 'cucumber', 'avocado', 'sweet potato', 'beetroot', 'pumpkin', 'squash', 'bean sprouts', 'spring onion', 'shallot', 'ginger', 'chilli', 'lime', 'lemon'],
  'Grains & Pasta': ['rice', 'pasta', 'noodles', 'bread', 'flour', 'couscous', 'quinoa', 'oats', 'tortilla', 'wrap', 'pita', 'spaghetti', 'penne', 'fettuccine', 'linguine', 'macaroni'],
  'Nuts & Seeds': ['almonds', 'almond', 'walnuts', 'walnut', 'cashews', 'cashew', 'pecans', 'pecan', 'pistachios', 'pistachio', 'macadamia', 'pine nuts', 'peanuts', 'peanut', 'hazelnuts', 'hazelnut', 'chia seeds', 'chia', 'flaxseed', 'flax', 'hemp seeds', 'sunflower seeds', 'pumpkin seeds', 'pepitas', 'sesame seeds', 'linseed', 'coconut'],
  Pantry: ['oil', 'olive oil', 'salt', 'pepper', 'sugar', 'honey', 'vinegar', 'soy sauce', 'stock', 'broth', 'sauce', 'paste', 'cumin', 'paprika', 'turmeric', 'oregano', 'basil', 'thyme', 'rosemary', 'cinnamon', 'coriander', 'parsley', 'dill', 'mint', 'bay', 'mustard', 'ketchup', 'mayo', 'sriracha', 'sesame', 'coconut milk', 'tomato paste', 'tomato sauce', 'passata', 'cornflour', 'baking', 'vanilla', 'cacao', 'cocoa', 'chocolate', 'maple syrup', 'agave', 'nutritional yeast', 'miso', 'fish sauce', 'oyster sauce', 'hoisin', 'curry', 'garam masala', 'chilli flakes', 'nutmeg', 'cardamom', 'cloves', 'allspice', 'fennel seeds'],
}

// Words that are cooking descriptors, not ingredients — used to rejoin
// comma-separated entries like "onion, finely diced" into a single item.
const DESCRIPTOR_ONLY = /^((finely|roughly|thinly|coarsely)\s+)?(diced|sliced|chopped|minced|grated|shredded|cubed|halved|quartered|trimmed|peeled|crushed|torn|julienned|deseeded|deboned|deveined|bone-in|boneless|skinless|skin-on|to taste|for garnish|for serving|as needed|optional|cut into .+)$/i

function parseCustomIngredients(input) {
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean)
  const result = []
  for (const part of parts) {
    if (DESCRIPTOR_ONLY.test(part) && result.length > 0) {
      // Rejoin descriptor with the previous ingredient
      result[result.length - 1] += ', ' + part
    } else {
      result.push(part)
    }
  }
  return result
}

// ── Structured ingredient parsing & totalling ──

const UNICODE_FRACS = { '½': 0.5, '⅓': 1/3, '⅔': 2/3, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅙': 1/6, '⅚': 5/6, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 }

function parseAmount(str) {
  if (!str) return NaN
  const s = String(str).trim()
  const mixed = s.match(/^(\d+)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/)
  if (mixed) return parseInt(mixed[1]) + (UNICODE_FRACS[mixed[2]] || 0)
  if (UNICODE_FRACS[s]) return UNICODE_FRACS[s]
  const frac = s.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (frac) return parseInt(frac[1]) + parseInt(frac[2]) / parseInt(frac[3])
  const simple = s.match(/^(\d+)\/(\d+)$/)
  if (simple) return parseInt(simple[1]) / parseInt(simple[2])
  const n = parseFloat(s)
  return isNaN(n) ? NaN : n
}

function formatAmount(n) {
  const fracs = [
    [0, ''], [0.125, '⅛'], [0.25, '¼'], [0.333, '⅓'],
    [0.5, '½'], [0.667, '⅔'], [0.75, '¾'], [0.875, '⅞'], [1, ''],
  ]
  const whole = Math.floor(n)
  const remainder = n - whole
  let bestDist = Infinity, bestVal = 0, bestSym = ''
  for (const [val, sym] of fracs) {
    const dist = Math.abs(remainder - val)
    if (dist < bestDist) { bestDist = dist; bestVal = val; bestSym = sym }
  }
  const finalWhole = bestVal === 1 ? whole + 1 : whole
  const fracSym = bestVal === 1 ? '' : bestSym
  if (!fracSym) return String(finalWhole || 0)
  return finalWhole ? `${finalWhole}${fracSym}` : fracSym
}

const UNIT_PLURALS = {
  cup: 'cups', clove: 'cloves', piece: 'pieces', bunch: 'bunches',
  sprig: 'sprigs', slice: 'slices', can: 'cans',
}

function pluraliseUnit(unit, amount) {
  if (amount <= 1) return unit
  return UNIT_PLURALS[unit] || unit
}

// Normalise unit strings to canonical form
const UNIT_ALIASES = {
  teaspoon: 'tsp', teaspoons: 'tsp', tsp: 'tsp',
  tablespoon: 'tbsp', tablespoons: 'tbsp', tbsp: 'tbsp',
  cup: 'cup', cups: 'cup',
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', millilitre: 'ml', millilitres: 'ml', milliliter: 'ml', milliliters: 'ml',
  l: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  medium: 'medium', large: 'large', small: 'small',
  clove: 'clove', cloves: 'clove',
  piece: 'piece', pieces: 'piece',
  bunch: 'bunch', bunches: 'bunch',
  sprig: 'sprig', sprigs: 'sprig',
  slice: 'slice', slices: 'slice',
  can: 'can', cans: 'can', tin: 'can', tins: 'can',
}

function normaliseUnit(raw) {
  if (!raw) return ''
  // Strip parenthetical annotations like "tbsp (30mL)" → "tbsp"
  const stripped = raw.replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase()
  return UNIT_ALIASES[stripped] || stripped
}

// Volume units convertible via tsp as base (1 tsp = 5 mL)
const VOLUME_TSP = { tsp: 1, tbsp: 3, cup: 48, ml: 0.2 }
const ML_PER = { tsp: 5, tbsp: 15, cup: 250, ml: 1 }

function isVolumeUnit(unit) {
  return VOLUME_TSP[unit] !== undefined
}

// Normalise ingredient names for grouping — strip cooking descriptors so
// "broccoli florets" and "broccoli, cut into florets" merge into one line.
function normaliseIngredientName(raw) {
  let name = raw.toLowerCase().trim()
  // Remove parenthetical notes like "(low sodium)", "(for rolling)", "(85% cacao)"
  name = name.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
  // Remove trailing cooking descriptors after comma: "onion, diced" → "onion"
  name = name.replace(/,\s*(finely|roughly|thinly|coarsely)?\s*(diced|sliced|chopped|minced|grated|shredded|cubed|halved|quartered|trimmed|peeled|crushed|torn|julienned|deseeded|deboned|deveined|cut into[^,]*|butterflied|skin on|skin-on|bone-in|boneless|skinless|drained and rinsed|drained|soaked overnight|soaked|for rolling|for garnish|for serving|as needed|optional|dried|dry|low sodium|low-sodium)$/i, '')
  // Remove leading adjectives that don't change what you buy
  name = name.replace(/^(fresh|dried|dry|raw|canned|frozen|ground|smoked|roasted|toasted|pitted|extra virgin|low-sodium|low sodium|plain|pure|sea)\s+/i, '')
  // Remove trailing "powder" / "flakes" (e.g. "turmeric powder" → "turmeric")
  name = name.replace(/\s+(powder|flakes)$/i, '')
  // Collapse "florets" / "cut into florets" into base vegetable
  name = name.replace(/[, ]*(cut into\s+)?florets$/i, '')
  // Collapse whitespace
  name = name.trim().replace(/\s+/g, ' ')
  return name
}

// Build a structured ingredient occurrence from raw recipe data
function buildIngredientEntry(ing, day) {
  const rawName = (ing.name || '').toLowerCase().trim()
  return {
    name: rawName,
    normalisedName: normaliseIngredientName(rawName),
    amount: parseAmount(ing.amount),
    rawAmount: String(ing.amount || '').trim(),
    unit: normaliseUnit(ing.unit),
    rawUnit: (ing.unit || '').trim(),
    day,
  }
}

// Group entries by normalised name + unit. Volume units (tsp/tbsp/cup/ml) are grouped together.
// Then merge groups with the same normalised name but different unit types into one line.
function groupEntries(entries) {
  // Phase 1: group by name + unit-type
  const unitGroups = {}
  entries.forEach((entry) => {
    const unitKey = isVolumeUnit(entry.unit) ? '__volume__' : entry.unit
    const groupName = entry.normalisedName || entry.name
    const key = `${groupName}::${unitKey}`
    if (!unitGroups[key]) {
      unitGroups[key] = { name: groupName, unit: unitKey, entries: [] }
    }
    unitGroups[key].entries.push(entry)
  })

  // Phase 2: merge groups that share the same normalised name but have different units
  const merged = {}
  Object.values(unitGroups).forEach((group) => {
    if (!merged[group.name]) {
      merged[group.name] = { name: group.name, subGroups: [] }
    }
    merged[group.name].subGroups.push(group)
  })

  // Convert back: if only 1 subGroup, return as before. If multiple, merge into one group.
  return Object.values(merged).map((m) => {
    if (m.subGroups.length === 1) {
      return m.subGroups[0]
    }
    // Multiple unit types for same ingredient — combine all entries, mark as mixed
    const allEntries = m.subGroups.flatMap((sg) => sg.entries)
    return { name: m.name, unit: '__mixed__', entries: allEntries, subGroups: m.subGroups }
  })
}

// Sum a group of entries and produce a display string
function formatGroupTotal(group) {
  const { entries, unit } = group

  // Mixed-unit groups: format each sub-group separately and join with " + "
  if (unit === '__mixed__' && group.subGroups) {
    return group.subGroups.map((sg) => formatGroupTotal(sg)).join(' + ')
  }

  // Separate numeric from non-numeric entries
  const numeric = entries.filter((e) => !isNaN(e.amount))
  const raw = entries.filter((e) => isNaN(e.amount))

  if (numeric.length === 0) {
    // All non-numeric — show the first raw entry
    return raw.map((e) => e.rawUnit ? `${e.rawAmount} ${e.rawUnit}` : e.rawAmount).join(', ')
  }

  if (unit === '__volume__') {
    // Sum everything in tsp, then convert up
    let totalTsp = 0
    numeric.forEach((e) => { totalTsp += e.amount * VOLUME_TSP[e.unit] })

    // Salt & pepper: always display in tsp
    const isSaltOrPepper = /\b(salt|pepper)\b/i.test(group.name)

    // Clean cup fractions that are OK to display (¼, ⅓, ½, ⅔, ¾, 1)
    const CLEAN_CUP_FRACS = [0, 0.25, 1/3, 0.5, 2/3, 0.75]

    let displayUnit = 'tsp'
    let displayVal = totalTsp
    if (isSaltOrPepper) {
      // Keep in tsp always
    } else if (totalTsp >= 12) {
      const cupVal = totalTsp / 48
      const cupRemainder = cupVal - Math.floor(cupVal)
      const isCleanFrac = CLEAN_CUP_FRACS.some((f) => Math.abs(cupRemainder - f) < 0.01)
      if (isCleanFrac) {
        displayVal = cupVal
        displayUnit = 'cup'
      } else {
        // Awkward cup fraction — fall back to tbsp
        displayVal = totalTsp / 3
        displayUnit = 'tbsp'
      }
    } else if (totalTsp >= 3) {
      displayVal = totalTsp / 3
      displayUnit = 'tbsp'
    }
    const mlRaw = displayVal * ML_PER[displayUnit]
    const ml = Math.floor(mlRaw / 5) * 5
    const mlStr = `${ml}mL`
    const suffix = raw.length > 0 ? ` + ${raw.map((e) => e.rawAmount).join(', ')}` : ''
    return `${formatAmount(displayVal)} ${pluraliseUnit(displayUnit, displayVal)} (${mlStr})${suffix}`
  }

  // Non-volume: straight sum
  const total = numeric.reduce((sum, e) => sum + e.amount, 0)
  const displayUnit = unit ? pluraliseUnit(unit, total) : ''
  const suffix = raw.length > 0 ? ` + ${raw.map((e) => e.rawUnit ? `${e.rawAmount} ${e.rawUnit}` : e.rawAmount).join(', ')}` : ''
  return displayUnit ? `${formatAmount(total)} ${displayUnit}${suffix}` : `${formatAmount(total)}${suffix}`
}

function categoriseIngredient(name) {
  const lower = name.toLowerCase()
  for (const [category, keywords] of Object.entries(INGREDIENT_CATEGORIES)) {
    if (keywords.some((kw) => lower.includes(kw))) return category
  }
  return 'Other'
}

function extractProteinsFromFavourites(favourites) {
  const proteinSet = new Set()
  favourites.forEach((recipe) => {
    const text = [
      recipe.title || '',
      ...(recipe.meal_components || []).flatMap((c) => (c.ingredients || []).map((i) => i.name)),
      ...(recipe.ingredients || []).map((i) => i.name),
    ].join(' ').toLowerCase()

    KNOWN_PROTEINS.forEach((protein) => {
      if (text.includes(protein)) {
        const label = protein.charAt(0).toUpperCase() + protein.slice(1)
        proteinSet.add(label)
      }
    })
  })
  return Array.from(proteinSet).sort()
}

function getAllIngredients(recipe) {
  if (recipe.meal_components && recipe.meal_components.length > 0) {
    return recipe.meal_components.flatMap((c) => c.ingredients || [])
  }
  return recipe.ingredients || []
}

const MEAL_SLOTS = [
  { key: 'breakfast', label: 'Breakfast', isSnack: false },
  { key: 'snack1', label: 'Snack 1', isSnack: true },
  { key: 'lunch', label: 'Lunch', isSnack: false },
  { key: 'snack2', label: 'Snack 2', isSnack: true },
  { key: 'dinner', label: 'Dinner', isSnack: false },
]

function getDayNutrition(daySlots) {
  let calories = 0
  let protein = 0
  let count = 0
  if (!daySlots || typeof daySlots !== 'object') return null
  Object.values(daySlots).forEach((recipe) => {
    if (!recipe) return
    const n = recipe.nutrition_per_serving || recipe.usda_nutrition_per_serving
    if (n) {
      if (n.calories) { calories += parseFloat(n.calories) || 0 }
      if (n.protein) { protein += parseFloat(n.protein) || 0 }
      count++
    }
  })
  return count > 0 ? { calories: Math.round(calories), protein: Math.round(protein) } : null
}

export default function MealPlanner({ plan, onUpdatePlan, favourites, onGenerateRecipe, onViewRecipe, tier, onUpgrade }) {
  // activeSlot: "day::slot" string for picker/generate form targeting
  const [showPicker, setShowPicker] = useState(null)
  const [showGenerateForm, setShowGenerateForm] = useState(null)
  const [showShoppingList, setShowShoppingList] = useState(false)
  const [generatingSlot, setGeneratingSlot] = useState(null)
  const [error, setError] = useState(null)
  const [includeSnacks, setIncludeSnacks] = useState(() => {
    try { return localStorage.getItem('helix-planner-snacks') === 'true' } catch { return false }
  })
  const [mobileDay, setMobileDay] = useState(0)
  const [tipDismissed, setTipDismissed] = useState(() => {
    try { return localStorage.getItem('helix-planner-tip-dismissed') === 'true' } catch { return false }
  })

  const dismissTip = () => {
    setTipDismissed(true)
    try { localStorage.setItem('helix-planner-tip-dismissed', 'true') } catch {}
  }

  const toggleSnacks = () => {
    setIncludeSnacks((prev) => {
      const next = !prev
      try { localStorage.setItem('helix-planner-snacks', String(next)) } catch {}
      return next
    })
  }

  // Generate form state
  const [selectedProteins, setSelectedProteins] = useState([])
  const [customIngredients, setCustomIngredients] = useState('')
  const [method, setMethod] = useState('No preference')
  const [nutritionModes, setNutritionModes] = useState(['Balanced'])
  const [mealStructure, setMealStructure] = useState('all-in-one')
  const [servings, setServings] = useState(4)
  const [isMetric, setIsMetric] = useState(true)

  const extractedProteins = useMemo(() => extractProteinsFromFavourites(favourites), [favourites])

  const visibleSlots = includeSnacks ? MEAL_SLOTS : MEAL_SLOTS.filter((s) => !s.isSnack)

  const toggleProtein = (protein) => {
    setSelectedProteins((prev) =>
      prev.includes(protein) ? prev.filter((p) => p !== protein) : [...prev, protein]
    )
  }

  const toggleNutritionMode = (mode) => {
    if (EXCLUSIVE_MODES.includes(mode)) {
      setNutritionModes([mode])
      return
    }
    setNutritionModes((prev) => {
      const withoutExclusive = prev.filter((m) => !EXCLUSIVE_MODES.includes(m))
      if (withoutExclusive.includes(mode)) {
        const next = withoutExclusive.filter((m) => m !== mode)
        return next.length ? next : ['Balanced']
      }
      return [...withoutExclusive, mode]
    })
  }

  const resetForm = () => {
    setSelectedProteins([])
    setCustomIngredients('')
    setMethod('No preference')
    setNutritionModes(['Balanced'])
    setMealStructure('all-in-one')
    setServings(4)
    setIsMetric(true)
  }

  const slotKey = (day, slot) => `${day}::${slot}`

  const handleOpenGenerateForm = (day, slot) => {
    setShowPicker(null)
    setError(null)
    resetForm()
    setShowGenerateForm(slotKey(day, slot))
  }

  const handleOpenPicker = (day, slot) => {
    setShowGenerateForm(null)
    const key = slotKey(day, slot)
    setShowPicker(showPicker === key ? null : key)
  }

  const handlePickFavourite = (day, slot, recipe) => {
    onUpdatePlan(day, slot, recipe)
    setShowPicker(null)
  }

  const handleClear = (day, slot) => {
    onUpdatePlan(day, slot, null)
  }

  const handleGenerateMeal = async (day, slot) => {
    const ingredients = [
      ...selectedProteins,
      ...parseCustomIngredients(customIngredients),
    ]

    if (ingredients.length === 0) {
      setError('Please select at least one protein or enter ingredients.')
      return
    }

    setError(null)
    const key = slotKey(day, slot)
    setGeneratingSlot(key)
    setShowGenerateForm(null)

    try {
      await onGenerateRecipe(day, slot, {
        ingredients: ingredients.join(', '),
        method,
        mealType: ['Saturday', 'Sunday'].includes(day) ? 'weekend' : 'weekday',
        servings,
        units: isMetric ? 'metric' : 'imperial',
        nutritionMode: nutritionModes,
        mealStructure,
      })
    } catch {
      setError('Failed to generate recipe. Please try again.')
    } finally {
      setGeneratingSlot(null)
    }
  }

  const generateShoppingList = () => {
    const allEntries = []
    DAYS.forEach((day) => {
      const daySlots = plan[day]
      if (!daySlots || typeof daySlots !== 'object') return
      Object.entries(daySlots).forEach(([, recipe]) => {
        if (!recipe) return
        getAllIngredients(recipe).forEach((ing) => {
          if (!ing.name || !ing.name.trim()) return // skip entries with no ingredient name
          allEntries.push(buildIngredientEntry(ing, day))
        })
      })
    })

    const groups = groupEntries(allEntries)

    const items = groups.map((group) => ({
      name: group.name,
      displayName: group.entries[0].name || group.name,
      total: formatGroupTotal(group),
      category: categoriseIngredient(group.name),
      entries: group.entries,
    }))

    const byCategory = {}
    items.forEach((item) => {
      if (!byCategory[item.category]) byCategory[item.category] = []
      byCategory[item.category].push(item)
    })

    const order = ['Proteins', 'Vegetables', 'Fruit', 'Dairy', 'Grains & Pasta', 'Nuts & Seeds', 'Pantry', 'Other']
    const sorted = {}
    order.forEach((cat) => {
      if (byCategory[cat]) {
        sorted[cat] = byCategory[cat].sort((a, b) => a.name.localeCompare(b.name))
      }
    })
    Object.keys(byCategory).forEach((cat) => {
      if (!sorted[cat]) sorted[cat] = byCategory[cat].sort((a, b) => a.name.localeCompare(b.name))
    })
    return sorted
  }

  // Count all assigned meals across all slots
  const assignedCount = DAYS.reduce((count, day) => {
    const daySlots = plan[day]
    if (!daySlots || typeof daySlots !== 'object') return count
    return count + Object.values(daySlots).filter(Boolean).length
  }, 0)

  // Weekly nutrition summary
  const weeklyNutrition = useMemo(() => {
    let totalCals = 0
    let totalProtein = 0
    let daysWithData = 0
    DAYS.forEach((day) => {
      const n = getDayNutrition(plan[day])
      if (n) {
        totalCals += n.calories
        totalProtein += n.protein
        daysWithData++
      }
    })
    if (daysWithData === 0) return null
    return {
      avgCalories: Math.round(totalCals / daysWithData),
      avgProtein: Math.round(totalProtein / daysWithData),
      daysWithData,
    }
  }, [plan])

  const renderSlot = (day, slot) => {
    const key = slotKey(day, slot.key)
    const daySlots = plan[day] || {}
    const recipe = daySlots[slot.key]
    const isGenerating = generatingSlot === key

    return (
      <div key={slot.key} className="py-2 first:pt-0 last:pb-0">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[11px] font-medium uppercase tracking-wider ${slot.isSnack ? 'text-slate-500' : 'text-slate-400'}`}>
            {slot.label}
          </span>
          {recipe && (
            <button
              onClick={() => handleClear(day, slot.key)}
              className="text-slate-600 hover:text-red-400 text-[10px] cursor-pointer transition-colors leading-none"
              aria-label={`Remove ${slot.label}`}
            >
              ✕
            </button>
          )}
        </div>

        {isGenerating ? (
          <div className="flex items-center gap-2 py-1.5 text-slate-400 text-xs">
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating...
          </div>
        ) : recipe ? (
          <button
            onClick={() => onViewRecipe(recipe)}
            className="w-full text-left cursor-pointer group"
          >
            <p className="text-cream text-sm font-medium group-hover:text-gold transition-colors leading-snug">{recipe.title}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {recipe.nutritionMode && (
                (Array.isArray(recipe.nutritionMode) ? recipe.nutritionMode : [recipe.nutritionMode])
                  .filter((m) => m !== 'Balanced')
                  .map((mode) => (
                    <span key={mode} className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-gold/15 text-gold border border-gold/25">
                      {mode}
                    </span>
                  ))
              )}
              {recipe.difficulty && (
                <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${
                  recipe.difficulty === 'easy' ? 'bg-green-900/20 border-green-700/30 text-green-400' :
                  recipe.difficulty === 'medium' ? 'bg-amber-900/20 border-amber-700/30 text-amber-400' :
                  'bg-red-900/20 border-red-700/30 text-red-400'
                }`}>
                  {recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}
                </span>
              )}
              {(recipe.prep_time_minutes || recipe.cooking_time_minutes) && (
                <span className="text-slate-500 text-[11px]">
                  {(recipe.prep_time_minutes || 0) + (recipe.cooking_time_minutes || 0)} min
                </span>
              )}
              {recipe.nutrition_per_serving?.calories && (
                <span className="text-slate-500 text-[11px]">
                  {recipe.nutrition_per_serving.calories} kcal
                </span>
              )}
            </div>
          </button>
        ) : (
          <div className="flex gap-1.5">
            <button
              onClick={() => handleOpenPicker(day, slot.key)}
              className="flex-1 py-1.5 px-2 rounded-md text-[11px] text-slate-500 border border-dashed border-navy-lighter hover:border-gold/30 hover:text-cream transition-colors cursor-pointer"
            >
              + Favourites
            </button>
            <button
              onClick={() => handleOpenGenerateForm(day, slot.key)}
              className="flex-1 py-1.5 px-2 rounded-md text-[11px] text-gold/70 border border-dashed border-gold/15 hover:bg-gold/5 hover:text-gold transition-colors cursor-pointer"
            >
              + Generate
            </button>
          </div>
        )}

        {/* Favourite picker */}
        {showPicker === key && (
          <div className="mt-2 space-y-2 animate-fade-in">
            {favourites.length === 0 ? (
              <p className="text-slate-500 text-xs py-2">No favourites saved yet — generate a recipe and save it first!</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {favourites.map((fav) => (
                  <button
                    key={fav._favId}
                    onClick={() => handlePickFavourite(day, slot.key, fav)}
                    className="w-full text-left p-2 rounded-lg bg-navy hover:bg-navy-lighter/50 text-xs transition-colors cursor-pointer border border-navy-lighter/30"
                  >
                    <span className="text-cream font-medium">{fav.title}</span>
                    {fav.nutrition_per_serving?.calories && (
                      <span className="text-slate-500 text-[11px] ml-2">{fav.nutrition_per_serving.calories} kcal</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowPicker(null)}
              className="text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Generate form */}
        {showGenerateForm === key && (
          <div className="mt-2 space-y-3 animate-fade-in bg-navy rounded-xl p-3 border border-gold/20">
            <div>
              <label className="block text-xs font-medium text-cream mb-1.5">Protein / Main Ingredient</label>
              {extractedProteins.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {extractedProteins.map((protein) => (
                    <button
                      key={protein}
                      type="button"
                      onClick={() => toggleProtein(protein)}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all cursor-pointer border ${
                        selectedProteins.includes(protein)
                          ? 'bg-gold text-navy border-gold'
                          : 'bg-navy-light border-navy-lighter text-slate-400 hover:text-slate-200 hover:border-navy-lighter/80'
                      }`}
                    >
                      {protein}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-[11px] mb-2">No favourites saved yet — enter your ingredients below!</p>
              )}
              <input
                type="text"
                value={customIngredients}
                onChange={(e) => setCustomIngredients(e.target.value)}
                placeholder="Or enter your own ingredients (comma-separated)"
                className="w-full bg-navy-light border border-navy-lighter rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-cream mb-1.5">Cooking Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full bg-navy-light border border-navy-lighter rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 appearance-none cursor-pointer"
              >
                {COOKING_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-cream mb-1.5">Nutrition Mode</label>
              <div className="flex flex-wrap gap-1.5">
                {NUTRITION_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => toggleNutritionMode(mode)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
                      nutritionModes.includes(mode)
                        ? 'bg-gold text-navy border-gold shadow-sm'
                        : 'bg-navy-light border-navy-lighter text-slate-400 hover:text-slate-200 hover:border-navy-lighter/80'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-cream mb-1.5">Meal Structure</label>
              <div className="flex bg-navy-light rounded-lg border border-navy-lighter p-0.5">
                <button
                  type="button"
                  onClick={() => setMealStructure('all-in-one')}
                  className={`flex-1 py-1 px-2 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
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
                  className={`flex-1 py-1 px-2 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    mealStructure === 'main-plus-sides'
                      ? 'bg-gold text-navy shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Main + sides
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-cream mb-1.5">Servings</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={servings}
                  onChange={(e) => setServings(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                  className="w-full bg-navy-light border border-navy-lighter rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-cream mb-1.5">Units</label>
                <div className="flex bg-navy-light rounded-lg border border-navy-lighter p-0.5">
                  <button
                    type="button"
                    onClick={() => setIsMetric(true)}
                    className={`flex-1 py-1 px-2 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                      isMetric ? 'bg-gold text-navy shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Metric
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMetric(false)}
                    className={`flex-1 py-1 px-2 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                      !isMetric ? 'bg-gold text-navy shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Imperial
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowGenerateForm(null)}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-medium text-slate-400 border border-navy-lighter hover:border-gold/30 hover:text-cream transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const [d, s] = key.split('::')
                  handleGenerateMeal(d, s)
                }}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-gold text-navy hover:bg-gold-light transition-colors cursor-pointer"
              >
                Generate
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderDayColumn = (day) => {
    const daySlots = plan[day] || {}
    const dayNutrition = getDayNutrition(daySlots)

    return (
      <div
        key={day}
        className="bg-navy-light rounded-xl p-4 border border-navy-lighter/50"
      >
        <h3 className="text-sm font-semibold text-gold uppercase tracking-wide mb-3">{day}</h3>

        <div className="divide-y divide-navy-lighter/30">
          {visibleSlots.map((slot) => renderSlot(day, slot))}
        </div>

        {/* Daily nutrition summary */}
        {dayNutrition && (
          <div className="mt-3 pt-2 border-t border-navy-lighter/30 flex items-center gap-3 text-[11px]">
            <span className="text-slate-500">Daily total:</span>
            <span className="text-cream font-medium">{dayNutrition.calories} kcal</span>
            <span className="text-slate-500">|</span>
            <span className="text-cream font-medium">{dayNutrition.protein}g protein</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-cream">Meal Planner</h2>
      </div>

      {!tipDismissed && (
        <div className="relative bg-navy-light rounded-xl p-4 border border-gold/20 animate-fade-in">
          <button
            onClick={dismissTip}
            className="absolute top-2 right-2 text-slate-500 hover:text-cream text-sm leading-none cursor-pointer transition-colors p-1"
            aria-label="Dismiss tip"
          >
            ✕
          </button>
          <div className="flex items-start gap-3 pr-6">
            <span className="text-lg leading-none mt-0.5">💡</span>
            <div className="text-sm text-slate-300 leading-relaxed">
              {tier === 'performance' ? (
                <p>
                  Pro tip: Want macro-targeted meals in your plan? Head to the{' '}
                  <span className="font-bold text-cream">Macro Targets</span> tab, set your targets,
                  and generate your recipe. Save it to{' '}
                  <span className="font-bold text-cream">Favourites</span>, then add it to your meal
                  plan from here using the favourites button. This way every meal in your plan is
                  engineered to hit your numbers.
                </p>
              ) : (
                <>
                  <p>
                    Pro tip: Want every meal in your plan engineered to hit exact calorie, protein, and
                    macro targets? Upgrade to{' '}
                    <span className="font-bold text-cream">Performance</span> to unlock{' '}
                    <span className="font-bold text-cream">Macro Targets</span> — Chef Marco will
                    build recipes to your exact nutritional specifications.
                  </p>
                  <button
                    onClick={() => {
                      dismissTip()
                      if (onUpgrade) onUpgrade()
                    }}
                    className="mt-3 inline-flex items-center gap-1 text-gold hover:text-gold-light font-semibold text-sm cursor-pointer transition-colors"
                  >
                    Upgrade to Performance →
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Snack toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSnacks}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
            includeSnacks ? 'bg-gold' : 'bg-navy-lighter'
          }`}
          role="switch"
          aria-checked={includeSnacks}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
              includeSnacks ? 'translate-x-[18px]' : 'translate-x-[3px]'
            }`}
          />
        </button>
        <span className="text-sm text-slate-400">Include snacks</span>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm animate-fade-in">
          {error}
        </div>
      )}

      {/* Mobile day tabs — visible on small screens */}
      <div className="sm:hidden">
        <div className="flex overflow-x-auto gap-1 pb-2 -mx-1 px-1 scrollbar-hide">
          {DAYS.map((day, i) => (
            <button
              key={day}
              onClick={() => setMobileDay(i)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                mobileDay === i
                  ? 'bg-gold text-navy'
                  : 'bg-navy-light text-slate-400 hover:text-cream'
              }`}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
        {renderDayColumn(DAYS[mobileDay])}
      </div>

      {/* Desktop grid — hidden on small screens */}
      <div className="hidden sm:grid sm:grid-cols-1 gap-3">
        {DAYS.map((day) => renderDayColumn(day))}
      </div>

      {/* Weekly nutrition summary */}
      {weeklyNutrition && (
        <div className="bg-navy-light rounded-xl p-4 border border-gold/20">
          <h3 className="text-xs font-semibold text-gold/80 uppercase tracking-wider mb-2">Weekly Average</h3>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-slate-500 text-xs">Avg. daily calories: </span>
              <span className="text-cream font-semibold">{weeklyNutrition.avgCalories} kcal</span>
            </div>
            <div>
              <span className="text-slate-500 text-xs">Avg. daily protein: </span>
              <span className="text-cream font-semibold">{weeklyNutrition.avgProtein}g</span>
            </div>
            <span className="text-slate-600 text-[11px]">({weeklyNutrition.daysWithData} day{weeklyNutrition.daysWithData !== 1 ? 's' : ''} with data)</span>
          </div>
        </div>
      )}

      {/* Shopping list button */}
      {assignedCount > 0 && (
        <button
          onClick={() => setShowShoppingList(!showShoppingList)}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold bg-gold text-navy hover:bg-gold-light transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
          {showShoppingList ? 'Hide Shopping List' : `Generate Shopping List (${assignedCount} meal${assignedCount !== 1 ? 's' : ''})`}
        </button>
      )}

      {/* Shopping list */}
      {showShoppingList && (
        <div className="bg-navy-light rounded-xl p-6 border border-gold/20 animate-fade-in">
          <h3 className="text-lg font-semibold text-gold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            Shopping List
            <span className="text-xs font-normal text-slate-400 ml-1">({assignedCount} {assignedCount === 1 ? 'meal' : 'meals'})</span>
          </h3>
          {(() => {
            const grouped = generateShoppingList()
            const hasItems = Object.keys(grouped).length > 0
            if (!hasItems) return <p className="text-slate-500 text-sm">No recipes assigned yet.</p>
            return (
              <div className="space-y-5">
                {Object.entries(grouped).map(([category, items]) => (
                  <div key={category}>
                    <h4 className="text-xs font-semibold text-gold/80 uppercase tracking-wider mb-2">{category}</h4>
                    <ul className="space-y-1.5">
                      {items.map((item, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm">
                          <span className="text-gold/50 mt-0.5 shrink-0">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                            </svg>
                          </span>
                          <div>
                            <span className="text-cream font-medium">{item.displayName}</span>
                            <span className="text-gold/90 font-semibold ml-2 text-xs">
                              Total: {item.total}
                            </span>
                            {item.entries.length > 1 && (
                              <span className="text-slate-600 ml-2 text-[11px]">
                                {item.entries.map((e, j) => (
                                  <span key={j}>
                                    {j > 0 && ' + '}
                                    {e.rawAmount}{e.rawUnit ? ` ${e.rawUnit}` : ''} {e.day.slice(0, 3)}
                                  </span>
                                ))}
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
