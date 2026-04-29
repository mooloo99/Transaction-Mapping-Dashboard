import React from 'react'

export default function CompsFilters({ rows, filters, onChange, onClear }) {
  const { state, operator, assetType, dateFrom, dateTo, priceMin, priceMax, yieldMin, yieldMax, search } = filters

  function unique(field) {
    return [...new Set(rows.map(r => r[field]).filter(Boolean))].sort()
  }

  const activeCount = [state, operator, assetType, dateFrom, dateTo, priceMin, priceMax, yieldMin, yieldMax, search].filter(Boolean).length

  return (
    <div className="filters-panel">
      {/* search */}
      <div className="sidebar-section">
        <div className="section-label">Search</div>
        <input
          className="input-search"
          placeholder="Address, suburb or operator…"
          value={search}
          onChange={e => onChange('search', e.target.value)}
        />
      </div>

      {/* filters */}
      <div className="sidebar-section">
        <div className="section-label-row">
          <span className="section-label">Filters</span>
          {activeCount > 0 && (
            <button className="btn-clear" onClick={onClear}>Clear ({activeCount})</button>
          )}
        </div>

        <label className="filter-label">State</label>
        <select className="input-select" value={state} onChange={e => onChange('state', e.target.value)}>
          <option value="">All states</option>
          {unique('state').map(s => <option key={s}>{s}</option>)}
        </select>

        <label className="filter-label">Asset Type</label>
        <select className="input-select" value={assetType} onChange={e => onChange('assetType', e.target.value)}>
          <option value="">All asset types</option>
          {unique('asset_type').map(s => <option key={s}>{s}</option>)}
        </select>

        <label className="filter-label">Operator</label>
        <select className="input-select" value={operator} onChange={e => onChange('operator', e.target.value)}>
          <option value="">All operators</option>
          {unique('operator').map(s => <option key={s}>{s}</option>)}
        </select>

        <label className="filter-label">Sale Date From</label>
        <input className="input-date" type="date" value={dateFrom} onChange={e => onChange('dateFrom', e.target.value)} />

        <label className="filter-label">Sale Date To</label>
        <input className="input-date" type="date" value={dateTo} onChange={e => onChange('dateTo', e.target.value)} />

        <label className="filter-label">Sale Price Min (AUD)</label>
        <input className="input-text" type="number" placeholder="e.g. 1000000" value={priceMin} onChange={e => onChange('priceMin', e.target.value)} />

        <label className="filter-label">Sale Price Max (AUD)</label>
        <input className="input-text" type="number" placeholder="e.g. 20000000" value={priceMax} onChange={e => onChange('priceMax', e.target.value)} />

        <label className="filter-label">Yield Min (%)</label>
        <input className="input-text" type="number" step="0.1" placeholder="e.g. 5.0" value={yieldMin} onChange={e => onChange('yieldMin', e.target.value)} />

        <label className="filter-label">Yield Max (%)</label>
        <input className="input-text" type="number" step="0.1" placeholder="e.g. 8.0" value={yieldMax} onChange={e => onChange('yieldMax', e.target.value)} />
      </div>
    </div>
  )
}
