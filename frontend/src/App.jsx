import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import PublicDashboard from './pages/PublicDashboard';

function App() {
  return (
    <Router>
      <div className="w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
        <Routes>
          <Route path="/" element={<PublicDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
