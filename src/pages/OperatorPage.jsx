import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import Nav from '../components/Nav'

const API = 'http://localhost:8000'

// Fix Leaflet default icon path in Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const droneIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="
    width:18px;height:18px;border-radius:50%;
    background:${color};border:2px solid #fff;
    box-shadow:0 0 8px ${color}88;
  "></div>`,
  iconSize: [18,18], iconAnchor: [9,9],
})

const DRONE_COLORS = { Drone0:'#38bdf8', Drone1:'#22c55e', Drone2:'#f59e0b' }
const STATUS_POLL_MS  = 2000
const REQUEST_POLL_MS = 5000

function batteryColor(pct) {
  if (pct > 50) return '#22c55e'
  if (pct > 20) return '#f59e0b'
  return '#ef4444'
}

// Fits map to show all drone markers
function FitMarkers({ positions }) {
  const map = useMap()
  useEffect(() => {
    const pts = positions.filter(p=>p).map(p=>[p.y, p.x])
    if (pts.length > 0) {
      try { map.fitBounds(pts, { padding: [50,50], maxZoom: 16 }) }
      catch(_) {}
    }
  }, [])  // only on mount
  return null
}

export default function OperatorPage() {
  const [drones,   setDrones]   = useState([])
  const [requests, setRequests] = useState([])
  const [altInput, setAltInput] = useState(20)
  const [dispatching, setDispatching] = useState(null)
  const [alert,    setAlert]    = useState(null)
  const trailsRef  = useRef({})   // drone_name -> [{x,y}]

  // ── Poll drone state ───────────────────────────────────────
  const fetchDrones = useCallback(async () => {
    try {
      const r = await fetch(`${API}/drones`)
      if (r.ok) {
        const data = await r.json()
        setDrones(data)
        // Update trails
        data.forEach(d => {
          if (!d.position) return
          const trail = trailsRef.current[d.drone_name] || []
          trail.push({x: d.position.x, y: d.position.y})
          if (trail.length > 120) trail.shift()  // keep last 120 pts
          trailsRef.current[d.drone_name] = trail
        })
      }
    } catch(_) {}
  }, [])

  // ── Poll requests ──────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    try {
      const r = await fetch(`${API}/requests`)
      if (r.ok) setRequests(await r.json())
    } catch(_) {}
  }, [])

  const clearStale = useCallback(async () => {
    if (!window.confirm('Clear all dispatched / completed / failed requests?')) return
    try {
      const r = await fetch(`${API}/requests/stale/all`, { method: 'DELETE' })
      if (r.ok) {
        const d = await r.json()
        setAlert({type:'success', msg:`✓ Cleared ${d.deleted_count} stale request(s).`})
        fetchRequests()
      }
    } catch(e) {
      setAlert({type:'error', msg:`✗ ${e.message}`})
    }
  }, [fetchRequests])

  const deleteRequest = useCallback(async (id) => {
    if (!window.confirm('Delete this request?')) return
    try {
      const r = await fetch(`${API}/requests/${id}`, { method: 'DELETE' })
      if (r.ok) {
        setAlert({type:'success', msg:'✓ Request deleted.'})
        fetchRequests()
      }
    } catch(e) {
      setAlert({type:'error', msg:`✗ ${e.message}`})
    }
  }, [fetchRequests])

  useEffect(() => {
    fetchDrones();   fetchRequests()
    const t1 = setInterval(fetchDrones,   STATUS_POLL_MS)
    const t2 = setInterval(fetchRequests, REQUEST_POLL_MS)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [fetchDrones, fetchRequests])

  // ── Dispatch ───────────────────────────────────────────────
  async function dispatch(reqId) {
    setDispatching(reqId); setAlert(null)
    try {
      const r = await fetch(`${API}/requests/${reqId}/dispatch`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ request_id: reqId, altitude_m: altInput })
      })
      if (!r.ok) throw new Error((await r.json()).detail || r.statusText)
      setAlert({type:'success', msg:'✓ Drones dispatched successfully.'})
      fetchRequests()
    } catch(err) {
      setAlert({type:'error', msg:`✗ ${err.message}`})
    } finally {
      setDispatching(null)
    }
  }

  // ── Map centre: average drone pos or default ───────────────
  const mapCenter = (() => {
    const active = drones.filter(d=>d.position)
    if (!active.length) return [1.29, 36.82]
    const avgLat = active.reduce((s,d)=>s+d.position.y,0)/active.length
    const avgLon = active.reduce((s,d)=>s+d.position.x,0)/active.length
    return [avgLat, avgLon]
  })()

  const pending = requests.filter(r=>r.status==='pending')

  return (
    <>
      <Nav />
      <div className="page-wide">
        <div className="hero">
          <h1>OPERATOR DISPATCH</h1>
          <p>Live drone telemetry · Delivery management · AirSim integration</p>
        </div>

        <div className="op-layout">

          {/* ── LEFT PANEL ────────────────────────────────── */}
          <div>
            {/* Drone status cards */}
            <div className="card">
              <div className="card-title">▸ Drone Fleet Status</div>
              {drones.length === 0
                ? <p className="text-muted">No drone data yet — is AirSim running?</p>
                : drones.map(d => {
                    const batt = d.battery_level ?? 0
                    const col  = batteryColor(batt)
                    const dCol = DRONE_COLORS[d.drone_name] || '#38bdf8'
                    return (
                      <div className="drone-card" key={d.drone_name}
                           style={{borderLeft:`3px solid ${dCol}`, marginBottom:'.8rem'}}>
                        <div className="drone-card-name">
                          ◉ {d.drone_name}
                          &nbsp;
                          <span className={`badge badge-${d.status||'idle'}`}>
                            {d.status||'idle'}
                          </span>
                          {d.stale && (
                            <span className="badge" style={{
                              background:'#450a0a',color:'#ef4444',marginLeft:6
                            }} title="AirSim may be closed — data is stale">
                              STALE
                            </span>
                          )}
                        </div>
                        <div className="battery-bar-bg">
                          <div className="battery-bar"
                               style={{width:`${batt}%`, background: col}} />
                        </div>
                        <div className="stat-row">
                          Battery <span style={{color:col}}>{batt.toFixed(1)}%</span>
                        </div>
                        <div className="stat-row">
                          Payload <span>{(d.current_payload||0).toFixed(1)} kg</span>
                        </div>
                        {d.position && (
                          <div className="stat-row">
                            Position&nbsp;
                            <span>
                              ({d.position.x?.toFixed(1)},&nbsp;
                               {d.position.y?.toFixed(1)},&nbsp;
                               {d.position.z?.toFixed(1)})
                            </span>
                          </div>
                        )}
                        <div className="stat-row">
                          Updated <span className="text-muted">
                            {d.last_update
                              ? new Date(d.last_update).toLocaleTimeString()
                              : '—'}
                          </span>
                        </div>
                      </div>
                    )
                  })
              }
            </div>

            {/* Dispatch controls */}
            <div className="card section-gap">
              <div className="card-title" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>▸ Dispatch Settings</span>
                <button className="btn btn-danger btn-sm" onClick={clearStale}
                        title="Clear all stale dispatched/failed/completed requests">
                  ✕ Clear Stale
                </button>
              </div>
              <div className="field">
                <label>Altitude override (m)</label>
                <input type="number" min={10} max={120} step={5}
                       value={altInput}
                       onChange={e=>setAltInput(Number(e.target.value))} />
              </div>
              {alert && (
                <div className={`alert alert-${alert.type}`} style={{marginTop:'.8rem'}}>
                  {alert.msg}
                </div>
              )}
            </div>

            {/* Pending requests list */}
            <div className="card section-gap">
              <div className="card-title">
                ▸ Pending Requests
                &nbsp;
                <span className="badge badge-pending">{pending.length}</span>
              </div>
              {pending.length === 0
                ? <p className="text-muted">No pending requests.</p>
                : pending.map(req => (
                    <div key={req._id} style={{
                      background:'var(--surface)', borderRadius:7,
                      padding:'.8rem', marginBottom:'.7rem',
                      border:'1px solid var(--border)'
                    }}>
                      <div style={{display:'flex', justifyContent:'space-between',
                                   alignItems:'center', marginBottom:'.4rem'}}>
                        <strong style={{color:'var(--text)', fontSize:'.9rem'}}>
                          {req.farmer_name}
                        </strong>
                        <span className="badge badge-pending">{req.status}</span>
                      </div>
                      <div className="stat-row">Crop <span>{req.crop_type}</span></div>
                      <div className="stat-row">Weight <span>{req.payload_weight} kg</span></div>
                      <div className="stat-row">
                        Dest <span>({req.dest_lat?.toFixed(4)}, {req.dest_lon?.toFixed(4)})</span>
                      </div>
                      {req.notes && (
                        <div className="stat-row text-muted" style={{marginTop:'.3rem'}}>
                          {req.notes}
                        </div>
                      )}
                      <div style={{marginTop:'.7rem'}}>
                        <button
                          className="btn btn-success btn-sm"
                          disabled={dispatching === req._id}
                          onClick={()=>dispatch(req._id)}
                        >
                          {dispatching===req._id
                            ? <><span className="spinner"/> Dispatching…</>
                            : '▶  Dispatch'}
                        </button>
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>

          {/* ── RIGHT PANEL: MAP ──────────────────────────── */}
          <div>
            <div className="card">
              <div className="card-title">▸ Live Drone Map</div>
              <div className="map-wrap">
                <MapContainer center={mapCenter} zoom={14}
                              style={{height:'100%',width:'100%'}}
                              scrollWheelZoom={true}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                  />
                  <FitMarkers positions={drones.map(d=>d.position)} />

                  {/* Drone markers */}
                  {drones.map(d => {
                    if (!d.position) return null
                    const col = DRONE_COLORS[d.drone_name] || '#38bdf8'
                    // AirSim NED: x=East, y=North → Leaflet [lat, lon] = [y, x]
                    // (approximate — works for short distances)
                    return (
                      <Marker key={d.drone_name}
                              position={[d.position.y, d.position.x]}
                              icon={droneIcon(col)}>
                        <Popup>
                          <strong>{d.drone_name}</strong><br/>
                          Battery: {(d.battery_level||0).toFixed(1)}%<br/>
                          Status: {d.status}<br/>
                          Alt: {Math.abs(d.position.z||0).toFixed(1)} m
                        </Popup>
                      </Marker>
                    )
                  })}

                  {/* Drone trails */}
                  {Object.entries(trailsRef.current).map(([name, pts]) => {
                    if (pts.length < 2) return null
                    const col = DRONE_COLORS[name] || '#38bdf8'
                    const latLngs = pts.map(p=>[p.y, p.x])
                    return (
                      <Polyline key={name} positions={latLngs}
                                color={col} weight={2} opacity={0.6}
                                dashArray="4 4" />
                    )
                  })}

                  {/* Destination markers for pending requests */}
                  {requests.filter(r=>r.dest_lat).map(r=>(
                    <Marker key={r._id}
                            position={[r.dest_lat, r.dest_lon]}
                            icon={L.divIcon({
                              className:'',
                              html:`<div style="
                                width:12px;height:12px;
                                background:#f59e0b;border-radius:50%;
                                border:2px solid #fff;
                              "></div>`,
                              iconSize:[12,12], iconAnchor:[6,6]
                            })}>
                      <Popup>
                        <strong>Delivery: {r.farmer_name}</strong><br/>
                        {r.crop_type} · {r.payload_weight} kg<br/>
                        Status: {r.status}
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
              <div style={{marginTop:'.7rem', display:'flex', gap:'1.5rem',
                           flexWrap:'wrap', fontSize:'.78rem', color:'var(--muted)'}}>
                {Object.entries(DRONE_COLORS).map(([name,col])=>(
                  <span key={name}>
                    <span style={{display:'inline-block',width:10,height:10,
                                  borderRadius:'50%',background:col,marginRight:5}}/>
                    {name}
                  </span>
                ))}
                <span>
                  <span style={{display:'inline-block',width:10,height:10,
                                borderRadius:'50%',background:'#f59e0b',marginRight:5}}/>
                  Delivery destination
                </span>
              </div>
            </div>

            {/* All requests table */}
            <div className="card section-gap">
              <div className="card-title">▸ All Delivery Requests</div>
              {requests.length === 0
                ? <p className="text-muted">No requests yet.</p>
                : (
                  <div style={{overflowX:'auto'}}>
                    <table className="req-table">
                      <thead>
                        <tr>
                          <th>Farmer</th>
                          <th>Crop</th>
                          <th>Weight</th>
                          <th>Destination</th>
                          <th>Status</th>
                          <th>Created</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {requests.map(r=>(
                          <tr key={r._id}>
                            <td>{r.farmer_name}</td>
                            <td>{r.crop_type}</td>
                            <td>{r.payload_weight} kg</td>
                            <td style={{fontFamily:'monospace',fontSize:'.8rem'}}>
                              {r.dest_lat?.toFixed(4)}, {r.dest_lon?.toFixed(4)}
                            </td>
                            <td>
                              <span className={`badge badge-${r.status}`}>{r.status}</span>
                            </td>
                            <td className="text-muted">
                              {r.created_at
                                ? new Date(r.created_at).toLocaleString()
                                : '—'}
                            </td>
                            <td>
                              <div style={{display:'flex',gap:'.4rem',flexWrap:'wrap'}}>
                              {r.status==='pending' && (
                                <button className="btn btn-success btn-sm"
                                        disabled={dispatching===r._id}
                                        onClick={()=>dispatch(r._id)}>
                                  ▶ Dispatch
                                </button>
                              )}
                              <button className="btn btn-danger btn-sm"
                                      onClick={()=>deleteRequest(r._id)}>
                                ✕
                              </button>
                            </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
