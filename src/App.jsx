import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import CompsMap, { COLOUR_MAP, markerColour } from './components/CompsMap.jsx'
import CompsTable from './components/CompsTable.jsx'
import CompsFilters from './components/CompsFilters.jsx'
import { parseCsvText } from './utils/parseComps.js'
import { geocodeMissing } from './utils/geocodeComps.js'

const DEFAULT_FILTERS = {
  state: '', operator: '', assetType: '',
  dateFrom: '', dateTo: '',
  priceMin: '', priceMax: '',
  yieldMin: '', yieldMax: '',
  search: '',
}

// normalise yield for comparison (stored as decimal 0.063 or whole 6.3)
function normYield(v) {
  if (v == null) return null
  return v < 1 ? v * 100 : v
}

export default function App() {
  const [rows, setRows]           = useState([])
  const [filters, setFilters]     = useState(DEFAULT_FILTERS)
  const [tab, setTab]             = useState('map')
  const [selectedRow, setSelected]= useState(null)
  const [flyTarget, setFlyTarget] = useState(null)
  const [uploadFile, setUploadFile]= useState(null)
  const [parseError, setParseError]= useState(null)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeStatus, setGeocodeStatus] = useState(null)

  const fileInputRef = useRef()

  // auto-load the geocoded dataset on startup
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}comparable_sales_geocoded.csv`)
      .then(r => r.text())
      .then(text => {
        const parsed = parseCsvText(text)
        setRows(parsed)
        setUploadFile('comparable_sales_geocoded.csv')
        const missing = parsed.filter(r => !r._mapped).length
        if (missing > 0) runGeocoding(parsed)
      })
      .catch(() => {
        // fallback to sample
        fetch(`${import.meta.env.BASE_URL}comparable_sales.csv`)
          .then(r => r.text())
          .then(text => {
            const parsed = parseCsvText(text)
            setRows(parsed)
            setUploadFile('comparable_sales.csv (sample)')
          })
          .catch(() => {})
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function runGeocoding(inputRows) {
    const missing = inputRows.filter(r => !r._mapped)
    if (!missing.length) return
    setGeocoding(true)
    setGeocodeStatus(`Geocoding ${missing.length} rows via Nominatim…`)
    const enriched = await geocodeMissing(inputRows, (done, total) => {
      setGeocodeStatus(`Geocoding ${done}/${total}…`)
    })
    setRows(enriched)
    setGeocoding(false)
    const stillMissing = enriched.filter(r => !r._mapped).length
    setGeocodeStatus(stillMissing > 0 ? `${stillMissing} rows could not be geocoded` : null)
  }

  function loadText(text, filename) {
    setParseError(null)
    try {
      const parsed = parseCsvText(text)
      setRows(parsed)
      setUploadFile(filename)
      setSelected(null)
      setFlyTarget(null)
      const missing = parsed.filter(r => !r._mapped).length
      if (missing > 0) runGeocoding(parsed)
    } catch (e) {
      setParseError(e.message)
    }
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => loadText(ev.target.result, file.name)
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleFilterChange(key, value) {
    setFilters(f => ({ ...f, [key]: value }))
  }

  function handleClearFilters() {
    setFilters(DEFAULT_FILTERS)
  }

  function handleTableRowClick(row) {
    setSelected(row)
    if (row._mapped) {
      setFlyTarget({ ...row, _ts: Date.now() })
      setTab('map')
    }
  }

  const filtered = useMemo(() => {
    const q = filters.search.toLowerCase()
    const priceMin = filters.priceMin !== '' ? parseFloat(filters.priceMin) : null
    const priceMax = filters.priceMax !== '' ? parseFloat(filters.priceMax) : null
    const yMin = filters.yieldMin !== '' ? parseFloat(filters.yieldMin) : null
    const yMax = filters.yieldMax !== '' ? parseFloat(filters.yieldMax) : null

    return rows.filter(r => {
      if (filters.state     && r.state     !== filters.state)      return false
      if (filters.operator  && r.operator  !== filters.operator)   return false
      if (filters.assetType && r.asset_type !== filters.assetType) return false
      if (filters.dateFrom  && r.sale_date && r.sale_date < filters.dateFrom) return false
      if (filters.dateTo    && r.sale_date && r.sale_date > filters.dateTo)   return false
      if (priceMin != null  && r.sale_price_aud != null && r.sale_price_aud < priceMin) return false
      if (priceMax != null  && r.sale_price_aud != null && r.sale_price_aud > priceMax) return false
      const y = normYield(r.yield)
      if (yMin != null && y != null && y < yMin) return false
      if (yMax != null && y != null && y > yMax) return false
      if (q) {
        const hay = [r.address, r.suburb, r.operator, r.asset_type].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, filters])

  const mappedCount   = filtered.filter(r => r._mapped).length
  const unmappedCount = filtered.filter(r => !r._mapped).length

  const activeFilterCount = Object.entries(filters).filter(([, v]) => v !== '').length

  return (
    <div className="app-shell">
      {/* ── sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <span className="brand-icon">📍</span>
            <div>
              <div className="brand-title">Comparable Sales</div>
              <div className="brand-sub">Valuation Intelligence</div>
            </div>
          </div>
        </div>

        {/* data source */}
        <div className="sidebar-section">
          <div className="section-label">Data Source</div>
          <button className="btn-upload" onClick={() => fileInputRef.current.click()}>
            Upload CSV
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
          {uploadFile && (
            <div className="upload-meta">
              <span className="upload-file">{uploadFile}</span>
              <span className="upload-count">
                {rows.length} rows · {rows.filter(r => r._mapped).length} mapped
                {rows.filter(r => !r._mapped).length > 0 && ` · ${rows.filter(r => !r._mapped).length} pending coords`}
              </span>
            </div>
          )}
          {parseError && <div className="parse-error">{parseError}</div>}
          {geocoding && (
            <div className="geocode-status geocode-running">
              <span className="spinner" /> {geocodeStatus}
            </div>
          )}
          {!geocoding && geocodeStatus && (
            <div className="geocode-status geocode-done">{geocodeStatus}</div>
          )}
        </div>

        {/* filters */}
        <CompsFilters
          rows={rows}
          filters={filters}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
        />

        {/* results summary */}
        <div className="results-count">
          {filtered.length} sale{filtered.length !== 1 ? 's' : ''} shown
          {unmappedCount > 0 && <span className="unmapped-note"> · {unmappedCount} table-only</span>}
        </div>

        {/* legend */}
        <div className="sidebar-section legend">
          <div className="section-label">Legend</div>
          {Object.entries(COLOUR_MAP).map(([type, colour]) => (
            <div key={type} className="legend-row">
              <span className="legend-dot" style={{ background: colour }} />
              <span>{type}</span>
            </div>
          ))}
          <div className="legend-row">
            <span className="legend-dot" style={{ background: '#64748b' }} />
            <span>Other</span>
          </div>
          <div className="legend-row" style={{ marginTop: 8 }}>
            <span className="status-dot mapped" /><span style={{ marginLeft: 4 }}>Mapped</span>
            <span className="status-dot unmapped" style={{ marginLeft: 12 }} /><span style={{ marginLeft: 4 }}>No coords</span>
          </div>
        </div>
      </aside>

      {/* ── main ── */}
      <main className="main-content">
        <div className="tab-bar">
          <button className={`tab-btn ${tab === 'map' ? 'active' : ''}`} onClick={() => setTab('map')}>
            Map View
            {mappedCount > 0 && <span className="tab-badge">{mappedCount}</span>}
          </button>
          <button className={`tab-btn ${tab === 'table' ? 'active' : ''}`} onClick={() => setTab('table')}>
            Table View
            {filtered.length > 0 && <span className="tab-badge">{filtered.length}</span>}
          </button>
        </div>

        <div className={`map-wrapper ${tab !== 'map' ? 'hidden' : ''}`}>
          <CompsMap rows={filtered} flyTarget={flyTarget} />
        </div>

        {tab === 'table' && (
          <CompsTable
            rows={filtered}
            selectedRow={selectedRow}
            onRowClick={handleTableRowClick}
          />
        )}
      </main>
    </div>
  )
}
