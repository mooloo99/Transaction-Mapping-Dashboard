import Papa from 'papaparse'

const STATE_MAP = {
  'new south wales': 'NSW', 'nsw': 'NSW',
  'queensland': 'QLD',      'qld': 'QLD',
  'victoria': 'VIC',        'vic': 'VIC',
  'western australia': 'WA','wa':  'WA',
  'south australia': 'SA',  'sa':  'SA',
  'tasmania': 'TAS',        'tas': 'TAS',
  'northern territory': 'NT','nt': 'NT',
  'australian capital territory': 'ACT', 'act': 'ACT',
}

function cleanState(s) {
  if (!s) return ''
  return STATE_MAP[String(s).trim().toLowerCase()] || String(s).trim().toUpperCase()
}

function cleanNum(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = parseFloat(String(v).replace(/[,$%\s]/g, ''))
  return isNaN(n) ? null : n
}

function cleanDate(v) {
  if (!v) return ''
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  return s
}

function cleanRow(r) {
  const lat = cleanNum(r.latitude)
  const lng = cleanNum(r.longitude)
  return {
    address:       String(r.address       || '').trim(),
    suburb:        String(r.suburb        || '').trim(),
    state:         cleanState(r.state),
    postcode:      String(r.postcode      || '').trim(),
    latitude:      lat,
    longitude:     lng,
    _mapped:       lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng),
    asset_type:    String(r.asset_type    || '').trim(),
    operator:      String(r.operator      || '').trim(),
    sale_price_aud:cleanNum(r.sale_price_aud),
    sale_date:     cleanDate(r.sale_date),
    nla_sqm:       cleanNum(r.nla_sqm),
    site_area_sqm: cleanNum(r.site_area_sqm),
    price_per_sqm: cleanNum(r.price_per_sqm),
    yield:         cleanNum(r.yield),
    purchaser:     String(r.purchaser     || '').trim(),
    vendor:        String(r.vendor        || '').trim(),
    comments:      String(r.comments      || '').trim(),
    source_report: String(r.source_report || '').trim(),
    source_page:   String(r.source_page   || '').trim(),
  }
}

export function parseCsvText(text) {
  const { data, errors } = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })
  if (errors.length && !data.length) {
    throw new Error('Could not parse CSV: ' + errors[0].message)
  }
  // dedupe on address + sale_date
  const seen = new Set()
  return data
    .map(cleanRow)
    .filter(r => {
      if (!r.address) return false
      const key = `${r.address}|${r.sale_date}`.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}
