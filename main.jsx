import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import FarmerPage from './pages/FarmerPage'
import OperatorPage from './pages/OperatorPage'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/"         element={<FarmerPage />} />
      <Route path="/operator" element={<OperatorPage />} />
      <Route path="*"         element={<Navigate to="/" />} />
    </Routes>
  </BrowserRouter>
)
