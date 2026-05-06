/**
 * generateRecipeImage
 * Calls Pollinations.ai (free, no API key) to produce a food photography
 * image for a recipe. Returns a base64 data URL or null if it fails.
 *
 * Pollinations uses Flux by default — good quality, photorealistic.
 * Typical latency: 4–12 seconds.
 */
export async function generateRecipeImage(title, description = '') {
  // Build a tightly-crafted food-photography prompt
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
    'white plate',
    'clean background',
  ]
    .filter(Boolean)
    .join(', ')

  const encoded = encodeURIComponent(prompt)
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=800&height=480&nologo=true&model=flux`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20_000) // 20s hard cap

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (!response.ok) {
      console.warn('[imageGen] Pollinations returned', response.status)
      return null
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    return `data:${contentType};base64,${base64}`
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn('[imageGen] Timed out after 20s — skipping image')
    } else {
      console.error('[imageGen] Error:', err.message)
    }
    return null
  }
}
