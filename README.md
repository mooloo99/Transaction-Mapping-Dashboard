# Comparable Sales Map

Interactive mapping tool for Australian commercial property comparable sales extracted from valuation reports.

Built with Vite + React + Leaflet (OpenStreetMap). No backend. No paid APIs. Runs entirely in the browser.

---

## Quick start

```bash
npm install
npm run dev        # → http://localhost:5173
npm run build      # production build → dist/
```

---

## Data workflow

### 1. Place your sales comps file

Drop your Excel file as `StoreLocal_Sale_Comparables.xlsx` in the project root (or update the path in `scripts/geocode-comps.cjs`).

The expected sheet columns are:

| Column | Type | Notes |
|---|---|---|
| `address` | text | Street address |
| `suburb` | text | Suburb name |
| `state` | text | NSW / VIC / QLD / WA / SA / ACT / TAS / NT |
| `postcode` | text | |
| `latitude` | number | Optional — geocoded if blank |
| `longitude` | number | Optional — geocoded if blank |
| `asset_type` | text | e.g. Self-Storage, Commercial/Industrial |
| `operator` | text | |
| `sale_price_aud` | number | |
| `sale_date` | date | YYYY-MM-DD or DD/MM/YYYY |
| `nla_sqm` | number | Net lettable area m² |
| `site_area_sqm` | number | |
| `price_per_sqm` | number | |
| `yield` | number | Decimal (0.063) or percentage (6.3) |
| `purchaser` | text | |
| `vendor` | text | |
| `comments` | text | |
| `source_report` | text | PDF filename |
| `source_page` | text/number | |

### 2. Geocode the dataset

```bash
npm run geocode
```

This reads `StoreLocal_Sale_Comparables.xlsx`, cleans and deduplicates the data, fills in suburb-level coordinates for any rows missing `latitude`/`longitude`, and writes:

```
public/comparable_sales_geocoded.csv
```

Re-running is safe — rows with existing coordinates are not changed.

**Note on geocoding accuracy:** The script uses a bundled suburb-centroid lookup for offline speed. For property-level precision, the browser app automatically refines coordinates via OpenStreetMap Nominatim on first load (cached in `localStorage`).

### 3. How browser-side geocoding works

On startup the app:
1. Loads `public/comparable_sales_geocoded.csv` automatically
2. Checks `localStorage` for any previously geocoded addresses
3. For rows still missing coordinates, calls Nominatim (1 request/second to respect rate limits)
4. Caches results in `localStorage` — subsequent loads are instant

To force a re-geocode, clear `localStorage` in browser DevTools.

### 4. Refresh the geocoded dataset

After adding new rows to the XLSX:

```bash
npm run geocode   # regenerates public/comparable_sales_geocoded.csv
```

Then commit the updated CSV to the repo.

---

## Uploading a custom CSV

Click **Upload CSV** in the sidebar to load any CSV matching the schema above. The app replaces the current dataset and geocodes any missing rows automatically.

---

## Deployment (Railway)

The app is a pure static frontend. On Railway:

1. Connect the GitHub repo
2. Set build command: `npm run build`
3. Set publish directory: `dist`

No environment variables required.

---

## Project structure

```
scripts/
  geocode-comps.cjs       Node script — converts XLSX → geocoded CSV
public/
  comparable_sales_geocoded.csv   Pre-geocoded dataset (committed to repo)
  comparable_sales.csv            Sample fallback data
src/
  App.jsx                 Root layout and state
  App.css                 Styles
  main.jsx                Entry point + Leaflet icon fix
  components/
    CompsMap.jsx           Leaflet map, markers, popups
    CompsTable.jsx         Sortable sales table
    CompsFilters.jsx       Sidebar filter controls
  utils/
    parseComps.js          CSV parsing, cleaning, deduplication
    geocodeComps.js        Browser-side Nominatim geocoding + localStorage cache
```
