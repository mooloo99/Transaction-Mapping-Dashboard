import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Papa from 'papaparse'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'

// ─── helpers ────────────────────────────────────────────────────────────────

const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
const NUM = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 })

function fmtCurrency(v) {
  const n = parseFloat(v)
  return isNaN(n) ? '—' : AUD.format(n)
}
function fmtNum(v) {
  const n = parseFloat(v)
  return isNaN(n) ? '—' : NUM.format(n) + ' m²'
}
function fmtDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d) ? v : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtYield(v) {
  const n = parseFloat(v)
  return isNaN(n) ? '—' : n.toFixed(2) + '%'
}

function parseRow(row) {
  const lat = parseFloat(row.latitude)
  const lng = parseFloat(row.longitude)
  return {
    ...row,
    _lat: lat,
    _lng: lng,
    _valid: !isNaN(lat) && !isNaN(lng),
  }
}

function dedupe(rows) {
  const seen = new Set()
  return rows.filter((r) => {
    const key = [r.address, r.suburb, r.sale_date, r.sale_price_aud].join('|').toLowerCase().trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function unique(rows, field) {
  return [...new Set(rows.map((r) => r[field]).filter(Boolean))].sort()
}

// ─── map controller – flies to selected row ─────────────────────────────────

function MapController({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) {
      map.flyTo([target._lat, target._lng], 16, { duration: 0.8 })
    }
  }, [target, map])
  return null
}

// ─── coloured marker by asset type ──────────────────────────────────────────

const COLOURS = {
  'Childcare Centre': '#2563eb',
  'Medical Centre': '#16a34a',
  'Service Station': '#d97706',
  'Fast Food': '#dc2626',
  'Retail': '#7c3aed',
}
function markerColour(assetType) {
  return COLOURS[assetType] || '#64748b'
}
function makeIcon(colour) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.33 14 26 14 26S28 23.33 28 14C28 6.27 21.73 0 14 0z" fill="${colour}" stroke="white" stroke-width="1.5"/>
    <circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/>
  </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -38],
  })
}

// ─── main app ────────────────────────────────────────────────────────────────

export default function App() {
  const [allRows, setAllRows] = useState([])
  const [parseError, setParseError] = useState(null)
  const [uploadFileName, setUploadFileName] = useState(null)

  // filters
  const [filterState, setFilterState] = useState('')
  const [filterOperator, setFilterOperator] = useState('')
  const [filterAssetType, setFilterAssetType] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [search, setSearch] = useState('')

  // interaction
  const [selectedRow, setSelectedRow] = useState(null)
  const [activePopup, setActivePopup] = useState(null)
  const [tab, setTab] = useState('map') // 'map' | 'table'

  const fileInputRef = useRef()
  const tableRowRefs = useRef({})

  // load sample on first render
  useEffect(() => {
    fetch('/comparable_sales.csv')
      .then((r) => r.text())
      .then((text) => loadCsv(text, 'comparable_sales.csv'))
      .catch(() => {})
  }, [])

  function loadCsv(text, filename) {
    setParseError(null)
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: ({ data, errors }) => {
        if (errors.length && !data.length) {
          setParseError('Could not parse CSV. Check the file format.')
          return
        }
        const rows = dedupe(data.map(parseRow))
        setAllRows(rows)
        setUploadFileName(filename)
        setSelectedRow(null)
        setActivePopup(null)
      },
    })
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => loadCsv(ev.target.result, file.name)
    reader.readAsText(file)
    e.target.value = ''
  }

  // derived
  const validRows = useMemo(() => allRows.filter((r) => r._valid), [allRows])
  const invalidCount = allRows.length - validRows.length

  const states = useMemo(() => unique(validRows, 'state'), [validRows])
  const operators = useMemo(() => unique(validRows, 'operator'), [validRows])
  const assetTypes = useMemo(() => unique(validRows, 'asset_type'), [validRows])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return validRows.filter((r) => {
      if (filterState && r.state !== filterState) return false
      if (filterOperator && r.operator !== filterOperator) return false
      if (filterAssetType && r.asset_type !== filterAssetType) return false
      if (filterDateFrom && r.sale_date && r.sale_date < filterDateFrom) return false
      if (filterDateTo && r.sale_date && r.sale_date > filterDateTo) return false
      if (q) {
        const haystack = [r.address, r.suburb, r.operator].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [validRows, filterState, filterOperator, filterAssetType, filterDateFrom, filterDateTo, search])

  const handleMarkerClick = useCallback((row) => {
    setActivePopup(row)
    setSelectedRow(row)
  }, [])

  const handleTableRowClick = useCallback((row) => {
    setSelectedRow(row)
    setActivePopup(row)
    setTab('map')
    // small delay lets map tab render before flyTo
    setTimeout(() => setSelectedRow({ ...row }), 50)
  }, [])

  function clearFilters() {
    setFilterState('')
    setFilterOperator('')
    setFilterAssetType('')
    setFilterDateFrom('')
    setFilterDateTo('')
    setSearch('')
  }

  const mapCenter = filtered.length
    ? [filtered[0]._lat, filtered[0]._lng]
    : [-25.2744, 133.7751]

  const mapZoom = filtered.length ? 10 : 5

  const activeFiltersCount = [filterState, filterOperator, filterAssetType, filterDateFrom, filterDateTo, search].filter(Boolean).length

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

        {/* upload */}
        <div className="sidebar-section">
          <div className="section-label">Data Source</div>
          <button className="btn-upload" onClick={() => fileInputRef.current.click()}>
            Upload CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {uploadFileName && (
            <div className="upload-meta">
              <span className="upload-file">{uploadFileName}</span>
              <span className="upload-count">
                {allRows.length} rows · {validRows.length} mapped
                {invalidCount > 0 && ` · ${invalidCount} skipped`}
              </span>
            </div>
          )}
          {parseError && <div className="parse-error">{parseError}</div>}
        </div>

        {/* search */}
        <div className="sidebar-section">
          <div className="section-label">Search</div>
          <input
            className="input-search"
            placeholder="Address, suburb or operator…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* filters */}
        <div className="sidebar-section">
          <div className="section-label-row">
            <span className="section-label">Filters</span>
            {activeFiltersCount > 0 && (
              <button className="btn-clear" onClick={clearFilters}>
                Clear ({activeFiltersCount})
              </button>
            )}
          </div>

          <label className="filter-label">State</label>
          <select className="input-select" value={filterState} onChange={(e) => setFilterState(e.target.value)}>
            <option value="">All states</option>
            {states.map((s) => <option key={s}>{s}</option>)}
          </select>

          <label className="filter-label">Asset Type</label>
          <select className="input-select" value={filterAssetType} onChange={(e) => setFilterAssetType(e.target.value)}>
            <option value="">All asset types</option>
            {assetTypes.map((s) => <option key={s}>{s}</option>)}
          </select>

          <label className="filter-label">Operator</label>
          <select className="input-select" value={filterOperator} onChange={(e) => setFilterOperator(e.target.value)}>
            <option value="">All operators</option>
            {operators.map((s) => <option key={s}>{s}</option>)}
          </select>

          <label className="filter-label">Sale Date From</label>
          <input className="input-date" type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />

          <label className="filter-label">Sale Date To</label>
          <input className="input-date" type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
        </div>

        {/* results count */}
        <div className="results-count">
          {filtered.length} sale{filtered.length !== 1 ? 's' : ''} shown
        </div>

        {/* legend */}
        <div className="sidebar-section legend">
          <div className="section-label">Legend</div>
          {Object.entries(COLOURS).map(([type, colour]) => (
            <div key={type} className="legend-row">
              <span className="legend-dot" style={{ background: colour }} />
              <span>{type}</span>
            </div>
          ))}
          <div className="legend-row">
            <span className="legend-dot" style={{ background: '#64748b' }} />
            <span>Other</span>
          </div>
        </div>
      </aside>

      {/* ── main content ── */}
      <main className="main-content">
        {/* tab bar */}
        <div className="tab-bar">
          <button
            className={`tab-btn ${tab === 'map' ? 'active' : ''}`}
            onClick={() => setTab('map')}
          >
            Map View
          </button>
          <button
            className={`tab-btn ${tab === 'table' ? 'active' : ''}`}
            onClick={() => setTab('table')}
          >
            Table View
            {filtered.length > 0 && <span className="tab-badge">{filtered.length}</span>}
          </button>
        </div>

        {/* map */}
        <div className={`map-wrapper ${tab !== 'map' ? 'hidden' : ''}`}>
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            className="leaflet-map"
            key="main-map"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapController target={selectedRow} />
            {filtered.map((row, i) => (
              <Marker
                key={i}
                position={[row._lat, row._lng]}
                icon={makeIcon(markerColour(row.asset_type))}
                eventHandlers={{ click: () => handleMarkerClick(row) }}
              >
                <Popup className="sale-popup" maxWidth={340}>
                  <SalePopup row={row} />
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* table */}
        {tab === 'table' && (
          <div className="table-wrapper">
            {filtered.length === 0 ? (
              <div className="empty-state">No sales match current filters.</div>
            ) : (
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>Suburb</th>
                    <th>State</th>
                    <th>Asset Type</th>
                    <th>Operator</th>
                    <th>Sale Price</th>
                    <th>Sale Date</th>
                    <th>Yield</th>
                    <th>NLA</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => (
                    <tr
                      key={i}
                      ref={(el) => (tableRowRefs.current[i] = el)}
                      className={selectedRow === row ? 'row-selected' : ''}
                      onClick={() => handleTableRowClick(row)}
                    >
                      <td className="td-address">{row.address || '—'}</td>
                      <td>{row.suburb || '—'}</td>
                      <td>{row.state || '—'}</td>
                      <td>
                        <span
                          className="asset-badge"
                          style={{ background: markerColour(row.asset_type) + '22', color: markerColour(row.asset_type), borderColor: markerColour(row.asset_type) + '66' }}
                        >
                          {row.asset_type || '—'}
                        </span>
                      </td>
                      <td>{row.operator || '—'}</td>
                      <td className="td-num">{fmtCurrency(row.sale_price_aud)}</td>
                      <td className="td-num">{fmtDate(row.sale_date)}</td>
                      <td className="td-num">{fmtYield(row.yield)}</td>
                      <td className="td-num">{fmtNum(row.nla_sqm)}</td>
                      <td className="td-source">{row.source_report ? `${row.source_report}${row.source_page ? ` p.${row.source_page}` : ''}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ─── popup component ──────────────────────────────────────────────────────────

function SalePopup({ row }) {
  return (
    <div className="popup-inner">
      <div className="popup-header">
        <div className="popup-address">{row.address}</div>
        <div className="popup-suburb">{[row.suburb, row.state, row.postcode].filter(Boolean).join(', ')}</div>
        <span
          className="popup-badge"
          style={{ background: markerColour(row.asset_type) + '22', color: markerColour(row.asset_type), borderColor: markerColour(row.asset_type) + '55' }}
        >
          {row.asset_type}
        </span>
      </div>

      <div className="popup-price">{fmtCurrency(row.sale_price_aud)}</div>

      <div className="popup-grid">
        <PopupField label="Sale Date" value={fmtDate(row.sale_date)} />
        <PopupField label="Yield" value={fmtYield(row.yield)} />
        <PopupField label="Operator" value={row.operator} />
        <PopupField label="NLA" value={fmtNum(row.nla_sqm)} />
        <PopupField label="Site Area" value={fmtNum(row.site_area_sqm)} />
        <PopupField label="Price / m²" value={row.price_per_sqm ? fmtCurrency(row.price_per_sqm) + '/m²' : '—'} />
        <PopupField label="Purchaser" value={row.purchaser} />
        <PopupField label="Vendor" value={row.vendor} />
      </div>

      {row.comments && (
        <div className="popup-comments">{row.comments}</div>
      )}

      <div className="popup-source">
        <span className="popup-source-label">Source</span>
        {row.source_report || '—'}
        {row.source_page && <> · p.{row.source_page}</>}
      </div>
    </div>
  )
}

function PopupField({ label, value }) {
  return (
    <div className="popup-field">
      <div className="popup-field-label">{label}</div>
      <div className="popup-field-value">{value || '—'}</div>
    </div>
  )
}
