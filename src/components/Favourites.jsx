export default function Favourites({ favourites, onRemove, onView }) {
  if (favourites.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="w-16 h-16 mx-auto text-navy-lighter mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        <h2 className="text-xl font-semibold text-cream mb-2">No favourites yet</h2>
        <p className="text-slate-400">Save recipes by clicking the heart icon when viewing a recipe.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-cream mb-6">Your Favourites</h2>
      {favourites.map((recipe) => (
        <div
          key={recipe._favId}
          className="bg-navy-light rounded-xl p-5 border border-navy-lighter/50 flex items-start gap-4"
        >
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-cream truncate">{recipe.title}</h3>
            <p className="text-slate-400 text-sm mt-1 line-clamp-2">{recipe.description}</p>
            {recipe.allergens && recipe.allergens.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {recipe.allergens.map((a) => (
                  <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-navy border border-navy-lighter text-slate-400">
                    {a.charAt(0).toUpperCase() + a.slice(1)}
                  </span>
                ))}
              </div>
            )}
            {(recipe.prep_time_minutes || recipe.cooking_time_minutes || recipe.difficulty) && (
              <div className="flex flex-wrap gap-2 mt-2">
                {recipe.prep_time_minutes != null && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-navy border border-navy-lighter text-slate-400">
                    Prep: {recipe.prep_time_minutes}m
                  </span>
                )}
                {recipe.cooking_time_minutes != null && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-navy border border-navy-lighter text-slate-400">
                    Cook: {recipe.cooking_time_minutes}m
                  </span>
                )}
                {recipe.difficulty && (
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    recipe.difficulty === 'easy' ? 'bg-green-900/20 border-green-700/30 text-green-400' :
                    recipe.difficulty === 'medium' ? 'bg-amber-900/20 border-amber-700/30 text-amber-400' :
                    'bg-red-900/20 border-red-700/30 text-red-400'
                  }`}>
                    {recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}
                  </span>
                )}
              </div>
            )}
            {recipe.nutrition_per_serving && (
              <p className="text-slate-500 text-xs mt-2">
                {recipe.nutrition_per_serving.calories} kcal · {recipe.nutrition_per_serving.protein_g}g protein
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={() => onView(recipe)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-gold bg-gold/10 hover:bg-gold/20 transition-colors cursor-pointer"
            >
              View
            </button>
            <button
              onClick={() => onRemove(recipe._favId)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-red-400 bg-red-900/20 hover:bg-red-900/30 transition-colors cursor-pointer"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
