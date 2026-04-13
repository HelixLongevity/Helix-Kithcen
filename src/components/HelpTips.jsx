import { useState } from 'react'

const SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: '🍳',
    content: [
      {
        heading: 'How Helix Kitchen Works',
        text: 'Helix Kitchen uses AI to generate personalised recipes based on your ingredients, preferences, and nutritional goals. Simply tell Chef Marco what you have in the kitchen, choose your cooking method and preferences, and receive a complete recipe with nutritional information.',
      },
      {
        heading: 'Recipe Tabs',
        text: 'Use the tabs at the top to navigate between features. "Recipes" is your main recipe generator. "Favourites" saves recipes you love. "Meal Planner" helps you organise your week. "Macro Targets" lets you dial in specific nutritional goals. "Dish Request" lets you request a specific dish to be made with your ingredients.',
      },
      {
        heading: 'Saving Recipes',
        text: 'Tap the heart icon on any recipe to save it to your Favourites. Favourites are stored on your device, so they\'ll be there next time you open the app.',
      },
    ],
  },
  {
    id: 'nutrition',
    title: 'Nutrition & Macros',
    icon: '📊',
    content: [
      {
        heading: 'Nutrition Modes (Recipes Tab)',
        text: 'When generating a standard recipe, you can select nutrition preferences like Low Fat, High Protein, Low Carb, etc. These guide the AI toward recipes that lean in that direction — but they are guidelines, not guarantees. The actual macros depend on the ingredients you provide.',
      },
      {
        heading: 'Macro Targets (Performance Tier)',
        text: 'The Macro Targets feature lets you set specific calorie, protein, carbohydrate, fat, fibre, sugar, and sodium targets. You can set each macro as a minimum, maximum, or exact target. The AI will attempt to build a recipe that matches your targets as closely as possible.',
      },
      {
        heading: 'Nutritional Data Source',
        text: 'All nutritional values are estimated using the USDA FoodData Central database. These are reliable reference values, but actual nutrition can vary depending on the brand, cut, ripeness, and preparation method of your ingredients.',
      },
    ],
  },
  {
    id: 'macro-limits',
    title: 'Macro Target Limitations',
    icon: '⚠️',
    content: [
      {
        heading: 'Ingredients Have Inherent Macros',
        text: 'Every ingredient has a natural macro profile that cannot be changed. For example, beef steak is inherently higher in fat than skinless chicken breast. If you set a low fat target but include high-fat ingredients like beef, lamb, cheese, or avocado, it may be impossible to hit your fat target. The AI will do its best, but it cannot change the fundamental nutritional profile of your chosen ingredients.',
      },
      {
        heading: 'Common Ingredient Considerations',
        items: [
          { label: 'High fat', detail: 'Beef (especially mince and ribeye), lamb, pork belly, cheese, cream, coconut milk, avocado, nuts, butter, olive oil' },
          { label: 'High carb', detail: 'Rice, pasta, bread, potatoes, sweet potato, flour, sugar, honey, dried fruit' },
          { label: 'High protein', detail: 'Chicken breast, turkey, fish, tofu, eggs, Greek yoghurt, legumes, lean beef' },
          { label: 'Low calorie', detail: 'Leafy greens, zucchini, capsicum, mushrooms, tomatoes, cucumber, herbs' },
        ],
      },
      {
        heading: 'Realistic Target Setting',
        text: 'If you are strict about hitting specific macro targets, choose ingredients that naturally align with those goals. For example, a high-protein / low-fat meal works well with chicken breast, white fish, or tofu — but will be very difficult to achieve with ribeye steak or pork belly.',
      },
      {
        heading: 'Refinement',
        text: 'If a macro recipe doesn\'t quite hit your targets, use the Refinement tool. It will suggest specific ingredient quantity adjustments (e.g., reduce oil by 5g, add 50g extra chicken) to bring the macros closer to your goals. You can fine-tune these suggestions with the sliders before applying.',
      },
    ],
  },
  {
    id: 'tips',
    title: 'Tips for Best Results',
    icon: '💡',
    content: [
      {
        heading: 'Be Specific With Ingredients',
        text: 'Instead of just "chicken", try "chicken breast" or "chicken thighs with skin". The more specific you are, the better the recipe and nutrition estimates will be.',
      },
      {
        heading: 'Include Staples',
        text: 'Don\'t forget to mention pantry staples you have available — things like olive oil, garlic, onions, salt, and pepper. Chef Marco will assume basic seasonings are available, but mentioning them helps.',
      },
      {
        heading: 'Weekend vs Weekday',
        text: 'The Weekend toggle tells Chef Marco you have more time to cook. Weekday recipes are designed to be quicker and simpler, while weekend recipes may include more steps, longer cook times, and more elaborate techniques.',
      },
      {
        heading: 'Meal Structure',
        text: 'Choose "All-in-one" for a single complete dish (like a stir-fry or casserole), or "Main + Sides" to get a main protein with separate side dishes. This affects how your macros are distributed across the meal.',
      },
      {
        heading: 'Cooking Method Matters',
        text: 'Your choice of cooking method can affect nutrition. For example, BBQ and oven roasting allow fat to drip away, while stove-top frying may require added oil. If you\'re watching fat intake, consider your cooking method.',
      },
      {
        heading: 'Include and Exclude Ingredients',
        text: 'In the Macro Targets feature, you can specify ingredients to include (must appear in the recipe) or exclude (allergies, dislikes, or dietary restrictions). Use this to work around intolerances or simply avoid foods you don\'t enjoy.',
      },
    ],
  },
  {
    id: 'important-notes',
    title: 'Important Notes',
    icon: '📋',
    content: [
      {
        heading: 'AI-Generated Content',
        text: 'All recipes are generated by AI. While Chef Marco is designed to produce safe, tasty, and nutritionally sensible recipes, always use your own judgement when cooking. Check for allergens, ensure foods are cooked to safe temperatures, and adjust seasoning to taste.',
      },
      {
        heading: 'Not Medical Advice',
        text: 'Helix Kitchen is a cooking tool, not a medical device. The nutritional information provided is estimated and should not be used as the sole basis for medical dietary decisions. If you have specific dietary requirements for a medical condition, consult your doctor or an accredited dietitian.',
      },
      {
        heading: 'Nutrition Estimates',
        text: 'Nutritional values are estimates based on USDA reference data and standard serving sizes. Actual values will vary based on specific brands, preparation methods, and ingredient variations. Use these as a helpful guide, not an exact measurement.',
      },
      {
        heading: 'Recipe Limits',
        text: 'Depending on your subscription tier, you may have a monthly recipe limit. Your current usage is shown in the header. Upgrade your plan from the Account tab if you need more recipes.',
      },
    ],
  },
]

export default function HelpTips({ onClose }) {
  const [openSection, setOpenSection] = useState('getting-started')

  const toggleSection = (id) => {
    setOpenSection(openSection === id ? null : id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-4 pt-12 pb-12">
      <div className="bg-navy-light rounded-2xl border border-navy-lighter/50 shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-lighter/50">
          <h2 className="text-lg font-semibold text-cream">Help & Tips</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-cream transition-colors cursor-pointer text-xl leading-none"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto">
          {SECTIONS.map((section) => (
            <div key={section.id} className="rounded-xl border border-navy-lighter/40 overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-navy/50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="text-lg">{section.icon}</span>
                  <span className="text-sm font-medium text-cream">{section.title}</span>
                </span>
                <span className={`text-slate-400 transition-transform text-xs ${openSection === section.id ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {openSection === section.id && (
                <div className="px-4 pb-4 space-y-4">
                  {section.content.map((item, i) => (
                    <div key={i}>
                      <h4 className="text-sm font-medium text-gold mb-1">{item.heading}</h4>
                      {item.text && (
                        <p className="text-xs text-slate-300 leading-relaxed">{item.text}</p>
                      )}
                      {item.items && (
                        <div className="space-y-1.5 mt-1.5">
                          {item.items.map((entry, j) => (
                            <div key={j} className="flex gap-2 text-xs">
                              <span className="text-gold font-medium whitespace-nowrap">{entry.label}:</span>
                              <span className="text-slate-300">{entry.detail}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-navy-lighter/50 text-center">
          <p className="text-xs text-slate-500">
            Have more questions? Use the Feedback option to let us know.
          </p>
        </div>
      </div>
    </div>
  )
}
