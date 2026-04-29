/**
 * Browser-side geocoding via OpenStreetMap Nominatim.
 * Results are cached in localStorage so addresses are never re-fetched.
 * Respects Nominatim's 1 req/sec policy.
 */

const CACHE_KEY = 'comps_geocode_cache_v1'
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const UA        = 'StoreLocal-ComparablesSalesMap/1.0'

function loadCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}
function saveCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) } catch {}
}

function cacheKey(address, suburb, state) {
  return `${address}|${suburb}|${state}`.toLowerCase()
}

async function fetchNominatim(qs) {
  const res = await fetch(`${NOMINATIM}?${qs}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
  })
  if (!res.ok) return null
  const data = await res.json()
  if (data && data.length > 0) {
    return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) }
  }
  return null
}

async function geocodeOne(address, suburb, state, postcode) {
  const queries = [
    new URLSearchParams({ street: address, city: suburb, state, country: 'Australia', postalcode: postcode, format: 'json', limit: '1' }).toString(),
    new URLSearchParams({ q: `${address}, ${suburb} ${state} ${postcode} Australia`, format: 'json', limit: '1', countrycodes: 'au' }).toString(),
    new URLSearchParams({ q: `${suburb} ${state} Australia`, format: 'json', limit: '1', countrycodes: 'au' }).toString(),
  ]
  for (const qs of queries) {
    const result = await fetchNominatim(qs)
    if (result) return result
  }
  return null
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * For each row missing coordinates, attempt Nominatim geocoding.
 * Calls onProgress(index, total, row, coords|null) after each attempt.
 * Returns a new array with coordinates filled in where found.
 */
export async function geocodeMissing(rows, onProgress) {
  const cache  = loadCache()
  const result = rows.map(r => ({ ...r }))
  const missing = result.filter(r => !r._mapped)

  for (let i = 0; i < missing.length; i++) {
    const row = missing[i]
    const key = cacheKey(row.address, row.suburb, row.state)

    let coords = cache[key] !== undefined ? cache[key] : undefined

    if (coords === undefined) {
      await sleep(1100)
      coords = await geocodeOne(row.address, row.suburb, row.state, row.postcode)
      cache[key] = coords  // null means "tried and failed"
      saveCache(cache)
    }

    if (coords) {
      row.latitude  = coords.latitude
      row.longitude = coords.longitude
      row._mapped   = true
    }

    if (onProgress) onProgress(i + 1, missing.length, row, coords)
  }

  return result
}
