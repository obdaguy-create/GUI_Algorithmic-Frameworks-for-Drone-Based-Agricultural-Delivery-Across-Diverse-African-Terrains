import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Nav from '../components/Nav'

const API = 'http://localhost:8000'

const CROPS = ['Maize','Wheat','Rice','Soybeans','Coffee','Tea','Vegetables','Other']

export default function FarmerPage() {
  const nav = useNavigate()
  const [form, setForm] = useState({
    farmer_name:'', phone:'', crop_type:'Maize',
    payload_weight: 1.0,
    start_lat:'', start_lon:'',
    dest_lat:'',  dest_lon:'',
    notes:''
  })
  const [busy,    setBusy]    = useState(false)
  const [alert,   setAlert]   = useState(null)   // {type, msg}

  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const effAlt = () => {
    const base = 20, perKg = 1.5, min = 10
    return Math.max(base - form.payload_weight * perKg, min).toFixed(1)
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setAlert(null)
    try {
      const body = {
        ...form,
        start_lat: parseFloat(form.start_lat),
        start_lon: parseFloat(form.start_lon),
        dest_lat:  parseFloat(form.dest_lat),
        dest_lon:  parseFloat(form.dest_lon),
        payload_weight: parseFloat(form.payload_weight),
      }
      const r = await fetch(`${API}/requests`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(body)
      })
      if (!r.ok) throw new Error((await r.json()).detail || r.statusText)
      setAlert({type:'success', msg:'✓ Delivery request submitted! Redirecting to operator dashboard…'})
      setTimeout(()=>nav('/operator'), 2200)
    } catch(err) {
      setAlert({type:'error', msg:`✗ ${err.message}`})
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Nav />
      <div className="page">
        <div className="hero">
          <h1>REQUEST DELIVERY</h1>
          <p>Submit your agricultural delivery request — our drones handle the rest.</p>
        </div>

        <div className="card">
          <div className="card-title">▸ Delivery Request Form</div>
          <form onSubmit={submit}>
            <div className="form-grid">

              {/* Farmer info */}
              <div className="field">
                <label>Farmer Name</label>
                <input required value={form.farmer_name}
                       onChange={e=>set('farmer_name',e.target.value)}
                       placeholder="John Mwangi" />
              </div>
              <div className="field">
                <label>Phone Number</label>
                <input required value={form.phone}
                       onChange={e=>set('phone',e.target.value)}
                       placeholder="+254 7XX XXX XXX" />
              </div>

              {/* Crop */}
              <div className="field">
                <label>Crop / Cargo Type</label>
                <select value={form.crop_type} onChange={e=>set('crop_type',e.target.value)}>
                  {CROPS.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>

              {/* Weight */}
              <div className="field">
                <label>Payload Weight (kg) — effective altitude: {effAlt()} m</label>
                <div className="range-wrap">
                  <input type="range" min={0} max={10} step={0.5}
                         value={form.payload_weight}
                         onChange={e=>set('payload_weight',parseFloat(e.target.value))} />
                  <span className="range-val">{form.payload_weight} kg</span>
                </div>
              </div>

              {/* Start */}
              <div className="field">
                <label>Start Latitude</label>
                <input required type="number" step="any"
                       value={form.start_lat} onChange={e=>set('start_lat',e.target.value)}
                       placeholder="e.g. 1.2900" />
              </div>
              <div className="field">
                <label>Start Longitude</label>
                <input required type="number" step="any"
                       value={form.start_lon} onChange={e=>set('start_lon',e.target.value)}
                       placeholder="e.g. 36.820" />
              </div>

              {/* Destination */}
              <div className="field">
                <label>Destination Latitude</label>
                <input required type="number" step="any"
                       value={form.dest_lat} onChange={e=>set('dest_lat',e.target.value)}
                       placeholder="e.g. 1.3100" />
              </div>
              <div className="field">
                <label>Destination Longitude</label>
                <input required type="number" step="any"
                       value={form.dest_lon} onChange={e=>set('dest_lon',e.target.value)}
                       placeholder="e.g. 36.840" />
              </div>

              {/* Notes */}
              <div className="field full-span">
                <label>Notes (optional)</label>
                <textarea value={form.notes}
                          onChange={e=>set('notes',e.target.value)}
                          placeholder="Any special instructions…" />
              </div>
            </div>

            {alert && (
              <div className={`alert alert-${alert.type}`}>{alert.msg}</div>
            )}

            <div className="flex-end">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? <><span className="spinner"/> Submitting…</> : '▶  Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
