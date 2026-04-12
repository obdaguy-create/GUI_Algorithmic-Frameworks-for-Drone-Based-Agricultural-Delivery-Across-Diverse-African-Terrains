# ================================================================
#  GUI.py — Tkinter launcher with altitude + payload inputs
# ================================================================
import tkinter as tk
from tkinter import messagebox
import folium
import threading
import webbrowser
from AIRSIM_SIM import follow_waypoints_multi, DEFAULT_ALTITUDE_M
from UTILS import log_flight


class DroneGUI:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Drone Delivery Simulation")
        self.root.resizable(False, False)
        self._build()

    def _build(self):
        pad = {"padx": 10, "pady": 5}

        tk.Label(self.root, text="Start (lat, lon):").grid(row=0, column=0, sticky="e", **pad)
        self.start_entry = tk.Entry(self.root, width=28)
        self.start_entry.grid(row=0, column=1, **pad)

        tk.Label(self.root, text="Goal  (lat, lon):").grid(row=1, column=0, sticky="e", **pad)
        self.goal_entry = tk.Entry(self.root, width=28)
        self.goal_entry.grid(row=1, column=1, **pad)

        # Altitude
        tk.Label(self.root, text="Altitude (m):").grid(row=2, column=0, sticky="e", **pad)
        self.alt_var = tk.StringVar(value=str(int(DEFAULT_ALTITUDE_M)))
        tk.Spinbox(self.root, from_=10, to=120, increment=5,
                   textvariable=self.alt_var, width=8).grid(row=2, column=1, sticky="w", **pad)

        # Payload weight
        tk.Label(self.root, text="Payload weight (kg):").grid(row=3, column=0, sticky="e", **pad)
        self.weight_var = tk.DoubleVar(value=0.0)
        weight_frame = tk.Frame(self.root)
        weight_frame.grid(row=3, column=1, sticky="w", **pad)
        self.weight_slider = tk.Scale(weight_frame, from_=0.0, to=10.0, resolution=0.5,
                                      orient=tk.HORIZONTAL, variable=self.weight_var,
                                      length=160)
        self.weight_slider.pack(side=tk.LEFT)
        self.weight_label = tk.Label(weight_frame, text="0.0 kg", width=7)
        self.weight_label.pack(side=tk.LEFT)
        self.weight_var.trace_add("write", self._update_weight_label)

        tk.Button(self.root, text="▶  Calculate Route & Fly",
                  command=self._calculate, width=26, bg="#2563eb", fg="white",
                  font=("TkDefaultFont", 10, "bold")).grid(
            row=4, column=0, columnspan=2, pady=12)

        self.status = tk.StringVar(value="Ready.")
        tk.Label(self.root, textvariable=self.status, fg="#2563eb",
                 wraplength=320).grid(row=5, column=0, columnspan=2, pady=4)

    def _update_weight_label(self, *_):
        kg  = self.weight_var.get()
        alt = float(self.alt_var.get() or DEFAULT_ALTITUDE_M)
        # Show effective altitude preview
        from AIRSIM_SIM import ALTITUDE_PER_KG, MIN_LOADED_ALTITUDE
        eff = max(alt - kg * ALTITUDE_PER_KG, MIN_LOADED_ALTITUDE)
        self.weight_label.config(text=f"{kg:.1f} kg")
        self.status.set(f"Effective altitude: {eff:.1f} m  |  Payload: {kg:.1f} kg")

    def _calculate(self):
        try:
            start  = tuple(map(float, self.start_entry.get().strip().split(",")))
            goal   = tuple(map(float, self.goal_entry.get().strip().split(",")))
            alt_m  = float(self.alt_var.get())
            weight = float(self.weight_var.get())

            if len(start) != 2 or len(goal) != 2:
                raise ValueError("Coordinates must be lat,lon")

            path = [start, goal]
            log_flight(f"Route: {path}  alt={alt_m}m  payload={weight}kg")
            self.status.set("Launching simulation…")
            self._show_map(path)

            threading.Thread(target=self._fly, args=(path, alt_m, weight),
                             daemon=True).start()

        except ValueError as e:
            messagebox.showerror("Input Error",
                                 f"Invalid input:\n{e}\n\nFormat: lat,lon  e.g. 1.29,36.82")
        except Exception as e:
            log_flight(f"GUI error: {e}")
            messagebox.showerror("Error", str(e))

    def _fly(self, path, alt_m, weight):
        self.status.set("Simulation running…")
        try:
            ok  = follow_waypoints_multi(path, altitude_m=alt_m, payload_kg=weight)
            msg = "✓ Flight complete." if ok else "Flight ended (see logs)."
        except Exception as e:
            log_flight(f"Simulation crashed: {e}")
            msg = f"Error: {e}"
        self.status.set(msg)

    def _show_map(self, path):
        try:
            m = folium.Map()
            m.fit_bounds(path)
            folium.PolyLine(path, color="red", weight=5).add_to(m)
            folium.Marker(path[0],  popup="Start", icon=folium.Icon(color="blue")).add_to(m)
            folium.Marker(path[-1], popup="End",   icon=folium.Icon(color="red")).add_to(m)
            m.save("temp_drone_route_map.html")
            webbrowser.open("temp_drone_route_map.html")
            log_flight("Map saved: temp_drone_route_map.html")
        except Exception as e:
            log_flight(f"Map error: {e}")

    def run(self):
        self.root.mainloop()
