#!/usr/bin/env node
/**
 * geocode-comps.cjs
 *
 * Reads StoreLocal_Sale_Comparables.xlsx, cleans + deduplicates the data,
 * resolves suburb-level coordinates from a bundled AU suburb lookup, then
 * writes public/comparable_sales_geocoded.csv.
 *
 * Usage:  node scripts/geocode-comps.cjs
 *
 * The app also performs browser-side Nominatim geocoding at runtime for any
 * rows still missing coordinates (cached in localStorage).
 *
 * Re-running is safe: rows with already-valid lat/lng are not touched.
 */

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const XLSX_PATH = path.resolve(__dirname, '../StoreLocal_Sale_Comparables.xlsx');
const OUT_PATH  = path.resolve(__dirname, '../public/comparable_sales_geocoded.csv');

// ── AU suburb coordinate lookup ──────────────────────────────────────────────
// Keyed as "suburb|state" (lowercase). Coordinates are suburb-centroid level.
const SUBURB_COORDS = {
  // NSW
  'bangalow|nsw':              [-28.6853, 153.5194],
  'jamisontown|nsw':           [-33.7200, 150.6950],
  'prestons|nsw':              [-33.9311, 150.8542],
  'bennetts green|nsw':        [-32.9167, 151.6011],
  'north boambee valley|nsw':  [-30.3508, 153.0683],
  'penrith|nsw':               [-33.7511, 150.6942],
  'liverpool|nsw':             [-33.9200, 150.9200],
  'newcastle|nsw':             [-32.9283, 151.7817],
  // VIC
  'yarraville|vic':            [-37.8181, 144.8839],
  'coburg north|vic':          [-37.7261, 144.9656],
  'truganina|vic':             [-37.8528, 144.7483],
  'thomastown|vic':            [-37.6850, 145.0197],
  'derrimut|vic':              [-37.8008, 144.7669],
  'heidelberg west|vic':       [-37.7522, 145.0508],
  'keilor park|vic':           [-37.7328, 144.8519],
  'tullamarine|vic':           [-37.7028, 144.8833],
  'campbellfield|vic':         [-37.6628, 144.9656],
  'melbourne|vic':             [-37.8136, 144.9631],
  // QLD
  'kawana|qld':                [-23.3127, 150.5167],  // Rockhampton area
  'hidden valley|qld':         [-27.5500, 152.6833],
  'dundowran|qld':             [-25.3167, 152.8333],
  'gaven|qld':                 [-27.9167, 153.3333],
  'redbank plains|qld':        [-27.6500, 152.8500],
  'redland bay|qld':           [-27.6169, 153.3003],
  'kawungan|qld':              [-25.2833, 152.8667],
  'warana|qld':                [-26.7167, 153.1167],
  'jimboomba|qld':             [-27.8369, 153.0319],
  'brisbane|qld':              [-27.4698, 153.0251],
  'gold coast|qld':            [-28.0167, 153.4000],
  'sunshine coast|qld':        [-26.6500, 153.0667],
  'hervey bay|qld':            [-25.2856, 152.8597],
  'rockhampton|qld':           [-23.3792, 150.5100],
  // WA
  'picton east|wa':            [-33.3571, 115.7100],
  'kelmscott|wa':              [-32.1194, 116.0147],
  'greenwood|wa':              [-31.8264, 115.7978],
  'ellenbrook|wa':             [-31.7803, 116.0019],
  'south bunbury|wa':          [-33.3658, 115.6383],
  'welshpool|wa':              [-31.9900, 115.9344],
  'bellevue|wa':               [-31.8861, 116.0219],
  'dalyellup|wa':              [-33.3883, 115.5836],
  'midvale|wa':                [-31.8872, 116.0506],
  'southern river|wa':         [-32.1039, 115.9892],
  'forrestdale|wa':            [-32.1508, 116.0183],
  'perth|wa':                  [-31.9505, 115.8605],
  // SA
  'adelaide|sa':               [-34.9285, 138.6007],
  // ACT
  'canberra|act':              [-35.2809, 149.1300],
  // TAS
  'hobart|tas':                [-42.8821, 147.3272],
  // NT
  'darwin|nt':                 [-12.4634, 130.8456],
};

function lookupSuburb(suburb, state) {
  const key = `${suburb.toLowerCase()}|${state.toLowerCase()}`;
  return SUBURB_COORDS[key] || null;
}

// ── state normalisation ──────────────────────────────────────────────────────
const STATE_MAP = {
  'new south wales': 'NSW', 'nsw': 'NSW',
  'queensland': 'QLD',      'qld': 'QLD',
  'victoria': 'VIC',        'vic': 'VIC',
  'western australia': 'WA','wa':  'WA',
  'south australia': 'SA',  'sa':  'SA',
  'tasmania': 'TAS',        'tas': 'TAS',
  'northern territory': 'NT','nt': 'NT',
  'australian capital territory': 'ACT', 'act': 'ACT',
};

function cleanState(s) {
  if (!s) return '';
  return STATE_MAP[String(s).trim().toLowerCase()] || String(s).trim().toUpperCase();
}
function cleanNum(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = parseFloat(String(v).replace(/[,$]/g, ''));
  return isNaN(n) ? '' : n;
}
function cleanDate(v) {
  if (!v) return '';
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return s;
}
function cleanRow(r) {
  return {
    address:       String(r.address       || '').trim(),
    suburb:        String(r.suburb        || '').trim(),
    state:         cleanState(r.state),
    postcode:      String(r.postcode      || '').trim(),
    latitude:      cleanNum(r.latitude),
    longitude:     cleanNum(r.longitude),
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
  };
}
function dedupeRows(rows) {
  const seen = new Set();
  return rows.filter(r => {
    const key = [r.address, r.sale_date].join('|').toLowerCase().trim();
    if (!key || key === '|') return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── CSV helpers ──────────────────────────────────────────────────────────────
const COLUMNS = [
  'address','suburb','state','postcode','latitude','longitude',
  'asset_type','operator','sale_price_aud','sale_date',
  'nla_sqm','site_area_sqm','price_per_sqm','yield',
  'purchaser','vendor','comments','source_report','source_page',
];
function csvEscape(v) {
  const s = String(v === null || v === undefined ? '' : v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
function rowsToCsv(rows) {
  const header = COLUMNS.join(',');
  const lines  = rows.map(r => COLUMNS.map(c => csvEscape(r[c] ?? '')).join(','));
  return [header, ...lines].join('\n') + '\n';
}

// ── main ─────────────────────────────────────────────────────────────────────
function main() {
  console.log('Reading XLSX…');
  const wb   = XLSX.readFile(XLSX_PATH);
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const raw  = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const rows = dedupeRows(raw.map(cleanRow));
  console.log(`  ${rows.length} unique rows (${raw.length} raw incl. duplicates)`);

  let resolved = 0;
  let stillMissing = 0;
  const missingList = [];

  for (const row of rows) {
    if (row.latitude !== '' && row.longitude !== '') continue; // already has coords

    const coords = lookupSuburb(row.suburb, row.state);
    if (coords) {
      row.latitude  = coords[0];
      row.longitude = coords[1];
      resolved++;
      console.log(`  ✓ Suburb lookup: ${row.suburb} ${row.state} → (${coords[0]}, ${coords[1]})`);
    } else {
      stillMissing++;
      missingList.push(`${row.suburb} ${row.state}`);
      console.log(`  ✗ No lookup for: ${row.suburb} ${row.state} (will geocode in browser)`);
    }
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, rowsToCsv(rows), 'utf8');

  console.log('\n─── Summary ───────────────────────────────────────────────');
  console.log(`  Total rows:           ${rows.length}`);
  console.log(`  Resolved via lookup:  ${resolved}`);
  console.log(`  Still missing coords: ${stillMissing}`);
  if (missingList.length) {
    console.log('  (These will be geocoded by the browser at runtime via Nominatim)');
    [...new Set(missingList)].forEach(s => console.log('    -', s));
  }
  console.log(`  Output: ${OUT_PATH}`);
}

main();
