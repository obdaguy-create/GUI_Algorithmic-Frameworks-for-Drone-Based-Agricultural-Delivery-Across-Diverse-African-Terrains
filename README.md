# GUI_Algorithmic-Frameworks-for-Drone-Based-Agricultural-Delivery-Across-Diverse-African-Terrains
A collection of all front end files used for the Project
# AgroFly — How to Run Everything

## File layout (place all in your project folder)
```
PROJECT/
├── MAIN.py(FRONTEND REPO)
├── GUI.py(FRONTEND REPO)              ← Can run independent of React ,used for visualization of Drone flight simulation Environment
├── AIRSIM_SIM.py (BACKEND REPO)       ← updated (altitude, weight, avoidance)
├── API.py (BACKEND REPO)              ← NEW: FastAPI backend
├── DB.py (BACKEND REPO)
├── CONFIG.py(BACKEND REPO)
├── UTILS.py(BACKEND REPO)
├── DATA_FETCHER.py(BACKEND REPO)
└── frontend/            ← NEW: React dashboards
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── index.css
        ├── components/Nav.jsx
        └── pages/
            ├── FarmerPage.jsx
            └── OperatorPage.jsx
```

---

## 1 — Install Python dependencies (venv_airsim39)
```powershell
& "...venv_airsim39\Scripts\Activate.ps1"
pip install fastapi uvicorn "pymongo[srv]" airsim numpy pyproj srtm.py requests folium
```

---

## 2 — Start AirSim (Unreal)
Open your AirSim environment in Unreal Engine as normal.
The Unreal window stays open separately — it IS the 3D visualisation.

---

## 3 — Start the FastAPI backend
```powershell
# In venv_airsim39
uvicorn api:app --reload --port 8000
```
Confirm: http://localhost:8000/health → {"status":"ok","db":true}

---

## 4 — Start the React frontend
```powershell
cd frontend
npm install       # first time only
npm run dev
```
Open: http://localhost:5173

---

## 5 — (Optional) Launch Tkinter GUI instead of browser
```powershell
python main.py
```
The Tkinter GUI lets you set altitude + payload weight and launch
a flight directly without using the browser dashboards.

---

## Weight → Altitude + Speed model
| Payload | Effective altitude (base 20m) | Speed reduction |
|---------|-------------------------------|-----------------|
| 0 kg    | 20.0 m                        | 0 m/s           |
| 2 kg    | 17.0 m                        | 1.6 m/s         |
| 5 kg    | 12.5 m                        | 4.0 m/s         |
| 8 kg    | 10.0 m (floor)                | 6.4 m/s         |

---

## Obstacle avoidance sensitivity
- Needs **3 consecutive** LiDAR checks blocked before triggering
- **Climbs first** (up to 4×6m = 24m) before trying side-sweep
- Side-sweep only if climbing alone doesn't clear the path
- **Hard 45-second timeout** — resumes flight regardless after that
- MIN_HIT_COUNT = 10 (was 6) — needs denser point cloud
