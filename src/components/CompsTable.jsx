import React from 'react'
import { markerColour } from './CompsMap.jsx'

const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
const NUM = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 })

function fmtCurrency(v) { return v != null ? AUD.format(v) : '—' }
function fmtNum(v)      { return v != null ? NUM.format(v) + ' m²' : '—' }
function fmtDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d) ? v : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtYield(v) { return v != null ? (v < 1 ? (v * 100).toFixed(2) : v.toFixed(2)) + '%' : '—' }

export default function CompsTable({ rows, selectedRow, onRowClick }) {
  if (rows.length === 0) {
    return <div className="empty-state">No comparable sales match the current filters.</div>
  }

  return (
    <div className="table-wrapper">
      <table className="sales-table">
        <thead>
          <tr>
            <th></th>
            <th>Address</th>
            <th>Suburb</th>
            <th>State</th>
            <th>Asset Type</th>
            <th>Operator</th>
            <th>Sale Price</th>
            <th>Sale Date</th>
            <th>Yield</th>
            <th>NLA</th>
            <th>Site Area</th>
            <th>Price/m²</th>
            <th>Purchaser</th>
            <th>Vendor</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`${selectedRow === row ? 'row-selected' : ''} ${!row._mapped ? 'row-unmapped' : ''}`}
              onClick={() => onRowClick(row)}
              title={!row._mapped ? 'Coordinates unavailable — not shown on map' : ''}
            >
              <td className="td-status">
                {row._mapped
                  ? <span className="status-dot mapped" title="Mapped" />
                  : <span className="status-dot unmapped" title="No coordinates" />}
              </td>
              <td className="td-address">{row.address || '—'}</td>
              <td>{row.suburb || '—'}</td>
              <td>{row.state || '—'}</td>
              <td>
                <span className="asset-badge" style={{
                  background: markerColour(row.asset_type) + '22',
                  color: markerColour(row.asset_type),
                  borderColor: markerColour(row.asset_type) + '66',
                }}>
                  {row.asset_type || '—'}
                </span>
              </td>
              <td>{row.operator || '—'}</td>
              <td className="td-num">{fmtCurrency(row.sale_price_aud)}</td>
              <td className="td-num">{fmtDate(row.sale_date)}</td>
              <td className="td-num">{fmtYield(row.yield)}</td>
              <td className="td-num">{fmtNum(row.nla_sqm)}</td>
              <td className="td-num">{fmtNum(row.site_area_sqm)}</td>
              <td className="td-num">{row.price_per_sqm != null ? fmtCurrency(row.price_per_sqm) + '/m²' : '—'}</td>
              <td>{row.purchaser || '—'}</td>
              <td>{row.vendor || '—'}</td>
              <td className="td-source">
                {row.source_report
                  ? `${row.source_report}${row.source_page ? ` p.${row.source_page}` : ''}`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
