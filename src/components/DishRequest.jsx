import { useState } from 'react'

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

export default function DishRequest({ onSubmit }) {
  const [dishDescription, setDishDescription] = useState('')
  const [method, setMethod] = useState('No preference')
  const [isWeekend, setIsWeekend] = useState(false)
  const [servings, setServings] = useState(4)
  const [isMetric, setIsMetric] = useState(true)
  const [nutritionModes, setNutritionModes] = useState(['Balanced'])
  const [mealStructure, setMealStructure] = useState('all-in-one')

  const EXCLUSIVE_MODES = ['Balanced', 'Full Flavour']

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

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!dishDescription.trim()) return
    onSubmit({
      dishDescription: dishDescription.trim(),
      method,
      mealType: isWeekend ? 'weekend' : 'weekday',
      servings,
      units: isMetric ? 'metric' : 'imperial',
      nutritionMode: nutritionModes,
      mealStructure,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-navy-light rounded-xl p-6 border border-navy-lighter/50 space-y-5">
        {/* Dish Description */}
        <div>
          <label className="block text-sm font-medium text-cream mb-2">
            Describe your dish to Chef Marco
          </label>
          <textarea
            value={dishDescription}
            onChange={(e) => setDishDescription(e.target.value)}
            placeholder="e.g. I want to make a beef stroganoff in a slow cooker"
            rows={3}
            className="w-full bg-navy border border-navy-lighter rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 resize-none"
            required
          />
        </div>

        {/* Cooking Method */}
        <div>
          <label className="block text-sm font-medium text-cream mb-2">
            Cooking method
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full bg-navy border border-navy-lighter rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 appearance-none cursor-pointer"
          >
            {COOKING_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Nutrition Mode */}
        <div>
          <label className="block text-sm font-medium text-cream mb-2">
            Nutrition mode
          </label>
          <div className="flex flex-wrap gap-2">
            {NUTRITION_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => toggleNutritionMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer border ${
                  nutritionModes.includes(mode)
                    ? 'bg-gold text-navy border-gold shadow-sm'
                    : 'bg-navy border-navy-lighter text-slate-400 hover:text-slate-200 hover:border-navy-lighter/80'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Meal Structure */}
        <div>
          <label className="block text-sm font-medium text-cream mb-2">
            Meal structure
          </label>
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

        {/* Toggles row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Meal type toggle */}
          <div>
            <label className="block text-sm font-medium text-cream mb-2">
              Meal type
            </label>
            <div className="flex bg-navy rounded-lg border border-navy-lighter p-1">
              <button
                type="button"
                onClick={() => setIsWeekend(false)}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all cursor-pointer ${
                  !isWeekend
                    ? 'bg-gold text-navy shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Weekday (quick)
              </button>
              <button
                type="button"
                onClick={() => setIsWeekend(true)}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all cursor-pointer ${
                  isWeekend
                    ? 'bg-gold text-navy shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Weekend (wow)
              </button>
            </div>
          </div>

          {/* Units toggle */}
          <div>
            <label className="block text-sm font-medium text-cream mb-2">
              Measurements
            </label>
            <div className="flex bg-navy rounded-lg border border-navy-lighter p-1">
              <button
                type="button"
                onClick={() => setIsMetric(true)}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all cursor-pointer ${
                  isMetric
                    ? 'bg-gold text-navy shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Metric
              </button>
              <button
                type="button"
                onClick={() => setIsMetric(false)}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all cursor-pointer ${
                  !isMetric
                    ? 'bg-gold text-navy shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Imperial
              </button>
            </div>
          </div>
        </div>

        {/* Servings */}
        <div>
          <label className="block text-sm font-medium text-cream mb-2">
            Number of servings
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={servings}
            onChange={(e) => setServings(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            className="w-24 bg-navy border border-navy-lighter rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
          />
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-gold hover:bg-gold-light text-navy font-semibold py-4 px-6 rounded-xl transition-colors text-lg shadow-lg shadow-gold/10 cursor-pointer"
      >
        Get Recipe from Chef Marco
      </button>
      <p className="text-xs text-slate-500 opacity-60 text-center mt-3">
        Recipes are created by Chef Marco AI — an AI-powered culinary assistant, not a real chef. Not medical advice.
      </p>
    </form>
  )
}
