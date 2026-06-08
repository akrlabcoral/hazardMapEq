import React from 'react'
import ReactDOM from 'react-dom/client'
import AdminDashboard from './pages/AdminDashboard.jsx'
import './index.css'
import 'maplibre-gl/dist/maplibre-gl.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div className="w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      <AdminDashboard />
    </div>
  </React.StrictMode>,
)
