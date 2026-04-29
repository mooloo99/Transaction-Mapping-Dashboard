import React, { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
const NUM = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 })

function fmtCurrency(v) { return v != null ? AUD.format(v) : '—' }
function fmtNum(v)      { return v != null ? NUM.format(v) + ' m²' : '—' }
function fmtDate(v)     {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d) ? v : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtYield(v)    { return v != null ? (v < 1 ? (v * 100).toFixed(2) : v.toFixed(2)) + '%' : '—' }

const COLOURS = {
  'Self-Storage':           '#2563eb',
  'Commercial/Industrial':  '#d97706',
  'Development Site':       '#16a34a',
  'Childcare Centre':       '#7c3aed',
  'Medical Centre':         '#0891b2',
}
export function markerColour(assetType) {
  return COLOURS[assetType] || '#64748b'
}
export const COLOUR_MAP = COLOURS

function makeIcon(colour) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.33 14 26 14 26S28 23.33 28 14C28 6.27 21.73 0 14 0z" fill="${colour}" stroke="white" stroke-width="1.5"/>
    <circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/>
  </svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [28, 40], iconAnchor: [14, 40], popupAnchor: [0, -38] })
}

function BoundsController({ rows, flyTarget }) {
  const map = useMap()

  useEffect(() => {
    if (flyTarget) {
      map.flyTo([flyTarget.latitude, flyTarget.longitude], 16, { duration: 0.8 })
      return
    }
    if (rows.length > 0) {
      const bounds = L.latLngBounds(rows.map(r => [r.latitude, r.longitude]))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }
  }, [rows, flyTarget]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

function SalePopup({ row }) {
  return (
    <div className="popup-inner">
      <div className="popup-header">
        <div className="popup-address">{row.address}</div>
        <div className="popup-suburb">{[row.suburb, row.state, row.postcode].filter(Boolean).join(', ')}</div>
        <span className="popup-badge" style={{
          background: markerColour(row.asset_type) + '22',
          color: markerColour(row.asset_type),
          borderColor: markerColour(row.asset_type) + '55',
        }}>{row.asset_type || '—'}</span>
      </div>
      <div className="popup-price">{fmtCurrency(row.sale_price_aud)}</div>
      <div className="popup-grid">
        {[
          ['Sale Date',   fmtDate(row.sale_date)],
          ['Yield',       fmtYield(row.yield)],
          ['Operator',    row.operator],
          ['NLA',         fmtNum(row.nla_sqm)],
          ['Site Area',   fmtNum(row.site_area_sqm)],
          ['Price / m²',  row.price_per_sqm != null ? fmtCurrency(row.price_per_sqm) + '/m²' : '—'],
          ['Purchaser',   row.purchaser],
          ['Vendor',      row.vendor],
        ].map(([label, value]) => (
          <div key={label} className="popup-field">
            <div className="popup-field-label">{label}</div>
            <div className="popup-field-value">{value || '—'}</div>
          </div>
        ))}
      </div>
      {row.comments && <div className="popup-comments">{row.comments}</div>}
      <div className="popup-source">
        <span className="popup-source-label">Source</span>
        {row.source_report || '—'}{row.source_page ? ` · p.${row.source_page}` : ''}
      </div>
    </div>
  )
}

export default function CompsMap({ rows, flyTarget }) {
  const mapped = rows.filter(r => r._mapped)

  return (
    <MapContainer
      center={[-25.2744, 133.7751]}
      zoom={5}
      className="leaflet-map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <BoundsController rows={mapped} flyTarget={flyTarget} />
      {mapped.map((row, i) => (
        <Marker
          key={i}
          position={[row.latitude, row.longitude]}
          icon={makeIcon(markerColour(row.asset_type))}
        >
          <Popup className="sale-popup" maxWidth={340}>
            <SalePopup row={row} />
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
