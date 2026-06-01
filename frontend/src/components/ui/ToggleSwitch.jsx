// src/components/ui/ToggleSwitch.jsx
// Reusable toggle switch component — replaces repeated toggle pattern across Dashboard

export function ToggleSwitch({ checked, onChange, disabled = false }) {
  return (
    <label className={`cursor-pointer ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      <div className={`w-10 h-5 rounded-full p-1 flex transition-colors duration-300 ${checked ? 'bg-cyan-500' : 'bg-slate-700'}`}>
        <div className={`w-3 h-3 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
      <input type="checkbox" checked={checked} onChange={onChange} className="hidden" disabled={disabled} />
    </label>
  );
}
