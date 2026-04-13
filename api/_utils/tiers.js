export const TIERS = {
  starter: {
    name: 'Starter',
    monthlyPrice: 999,
    yearlyPrice: 9999,
    monthlyPriceId: 'price_1TGWGu9Ng3RHYfRnASXfS3Zp',
    yearlyPriceId: 'price_1TGWOT9Ng3RHYfRnN1dSMKLR',
    features: ['Recipe generation', 'Save favourites', '20 recipes per month'],
    recipeLimit: 20,
  },
  kitchen: {
    name: 'Kitchen',
    monthlyPrice: 1999,
    yearlyPrice: 19999,
    monthlyPriceId: 'price_1TGWN09Ng3RHYfRnAWsD5bXg',
    yearlyPriceId: 'price_1TGWN09Ng3RHYfRnWE73m2WG',
    features: ['Unlimited recipes', 'Meal Planner', 'Shopping list generator'],
    recipeLimit: null,
  },
  performance: {
    name: 'Performance',
    monthlyPrice: 2999,
    yearlyPrice: 29999,
    monthlyPriceId: 'price_1TGWNR9Ng3RHYfRnVfNNy2v1',
    yearlyPriceId: 'price_1TGWO89Ng3RHYfRn9n2OdUNI',
    features: ['Everything in Kitchen', 'Macro Targets feature', 'Dish Request'],
    recipeLimit: null,
  },
};
