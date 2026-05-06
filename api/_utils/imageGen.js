/**
 * getRecipeImageUrl
 *
 * Returns a deterministic Pollinations.ai URL for a recipe photo.
 * No server-side fetch — the browser loads the image directly.
 *
 * A seed derived from the title ensures the same recipe always shows
 * the same generated photo across page refreshes.
 */
export function getRecipeImageUrl(title, description = '') {
  const shortDesc = description ? description.substring(0, 80) : ''

  const prompt = [
    `professional food photography of ${title}`,
    shortDesc,
    'restaurant quality plating',
    'natural soft lighting',
    'overhead angle',
    'fresh garnish',
    'appetising',
    'Michelin star presentation',
    'shallow depth of field',
    'clean background',
  ]
    .filter(Boolean)
    .join(', ')

  const seed = stableHash(title)

  return (
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=800&height=480&nologo=true&model=flux&seed=${seed}`
  )
}

/** Simple deterministic 32-bit hash of a string → positive integer */
function stableHash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0
  }
  return Math.abs(h)
}
