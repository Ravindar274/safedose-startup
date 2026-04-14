'use client';

import { useState, useEffect, useMemo } from 'react';
import '../patient-dashboard.css';
import './medications.css';

function EditMedicationModal({ med, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:         med.name || '',
    genericName:  med.genericName || '',
    dosage:       med.dosage || '',
    frequency:    med.frequency || 'once daily',
    scheduleTimes: med.scheduleTimes || ['08:00 AM'],
    isOngoing:    med.isOngoing ?? true,
    startDate:    med.startDate ? new Date(med.startDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    endDate:      med.endDate ? new Date(med.endDate).toISOString().slice(0, 10) : '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function generateTimes(firstTimeStr, count) {
    if (count <= 1) return [firstTimeStr || '08:00 AM'];
    let [time, period] = (firstTimeStr || '08:00 AM').split(' ');
    let [h, m] = time.split(':').map(Number);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;

    const times = [];
    const interval = Math.floor(24 / count);
    for (let i = 0; i < count; i++) {
      let curH = (h + i * interval) % 24;
      const ampm = curH >= 12 ? 'PM' : 'AM';
      let dispH = curH % 12;
      if (dispH === 0) dispH = 12;
      times.push(`${String(dispH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`);
    }
    return times;
  }

  function handleFreqChange(e) {
    const freq = e.target.value;
    const map = { 'once daily': 1, 'twice daily': 2, 'three times daily': 3, 'four times daily': 4 };
    const count = map[freq] || 1;
    setForm(prev => ({
      ...prev,
      frequency: freq,
      scheduleTimes: generateTimes(prev.scheduleTimes[0], count),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/patient/medications/${med._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to update medication.'); return; }
      onSaved(data.medication);
    } catch (err) {
      setError('An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Edit medication</h3>
            <p className="modal-sub">Update details for {med.name}.</p>
          </div>
          <button className="modal-close" onClick={onClose} type="button">
            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                 strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
          <div className="form-row-2">
            <div className="form-grp">
              <label>Brand Name</label>
              <input required value={form.name} readOnly />
              <span className="form-hint">Locked to the FDA-selected medication.</span>
            </div>
            <div className="form-grp">
              <label>Generic Name</label>
              <input required value={form.genericName} readOnly />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-grp">
              <label>Dosage (e.g., 20mg)</label>
              <input required value={form.dosage} onChange={e => setForm({...form, dosage: e.target.value})} />
            </div>
            <div className="form-grp">
              <label>Frequency</label>
              <select value={form.frequency} onChange={handleFreqChange}>
                <option value="once daily">Once daily</option>
                <option value="twice daily">Twice daily</option>
                <option value="three times daily">Three times daily</option>
                <option value="four times daily">Four times daily</option>
                <option value="once every 2 days">Once every 2 days</option>
                <option value="once every 3 days">Once every 3 days</option>
                <option value="once in a week">Once in a week</option>
              </select>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-grp" style={{ gridColumn: '1 / -1' }}>
              <label>Schedule times *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
                {form.scheduleTimes.map((time, idx) => (
                  <input 
                    key={idx} 
                    type="time" 
                    value={time ? (function(){
                      if (time.includes(':') && !time.includes(' ')) return time;
                      let [t, p] = time.split(' ');
                      let [hh, mm] = t.split(':').map(Number);
                      if (p === 'PM' && hh !== 12) hh += 12;
                      if (p === 'AM' && hh === 12) hh = 0;
                      return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
                    })() : '08:00'} 
                    onChange={e => {
                      const val = e.target.value;
                      if(!val) return;
                      let [hh, mm] = val.split(':').map(Number);
                      const p = hh >= 12 ? 'PM' : 'AM';
                      let dispH = hh % 12;
                      if (dispH === 0) dispH = 12;
                      const formatted = `${String(dispH).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${p}`;
                      
                      setForm(prev => {
                        if (idx === 0 && prev.scheduleTimes.length > 1) {
                          const map = { 'once daily': 1, 'twice daily': 2, 'three times daily': 3, 'four times daily': 4 };
                          const count = map[prev.frequency] || 1;
                          const newTimes = generateTimes(formatted, count);
                          return { ...prev, scheduleTimes: newTimes };
                        } else {
                          const newTimes = [...prev.scheduleTimes];
                          newTimes[idx] = formatted;
                          return { ...prev, scheduleTimes: newTimes };
                        }
                      });
                    }} 
                    required 
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-grp">
              <label>Start Date</label>
              <input type="date" required value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
            </div>
          </div>

          <div className="form-grp form-grp-check" style={{ marginTop: 8 }}>
            <input type="checkbox" id="isOngoing" checked={form.isOngoing} onChange={e => setForm({...form, isOngoing: e.target.checked})} />
            <label htmlFor="isOngoing">Ongoing medication (no end date)</label>
          </div>

          {!form.isOngoing && (
            <div className="form-grp" style={{ marginTop: 14 }}>
              <label>End Date</label>
              <input type="date" required value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} />
            </div>
          )}

          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            <button type="button" className="btn" style={{ flex: 1, background: 'var(--gray100)', color: 'var(--gray800)' }} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-teal" style={{ flex: 1 }} disabled={loading}>{loading ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MyMedications() {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('active'); // active, upcoming, past
  const [editingMed, setEditingMed] = useState(null);
  
  // Modals state
  const [confirmStop, setConfirmStop] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    async function fetchMeds() {
      try {
        const res = await fetch('/api/patient/medications');
        if (res.ok) {
          const data = await res.json();
          setMedications(data.medications || []);
        }
      } catch (err) {
        console.error('Failed to fetch medications:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchMeds();
  }, []);

  async function handleDelete(med) {
    setConfirmDelete(med);
  }

  async function executeDelete(medId) {
    try {
      const res = await fetch(`/api/patient/medications/${medId}`, { method: 'DELETE' });
      if (res.ok) {
        setMedications(prev => prev.filter(m => m._id !== medId));
      }
    } catch (err) {
      console.error('Failed to delete', err);
    } finally {
      setConfirmDelete(null);
    }
  }

  async function handleStop(med) {
    setConfirmStop(med);
  }
  
  async function executeStop(medId) {
    try {
      const res = await fetch(`/api/patient/medications/${medId}/stop`, { method: 'PATCH' });
      if (res.ok) {
        const data = await res.json();
        setMedications(prev => prev.map(m => m._id === medId ? data.medication : m));
      }
    } catch (err) {
      console.error('Failed to stop', err);
    } finally {
      setConfirmStop(null);
    }
  }

  function handleEditSaved(updatedMed) {
    setMedications(prev => prev.map(m => m._id === updatedMed._id ? updatedMed : m));
    setEditingMed(null);
  }

  const filteredMeds = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD', timezone-safe

    return medications.filter(med => {
      // 1. Search filter
      const matchesSearch = med.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            med.genericName.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      const startStr = med.startDate ? med.startDate.slice(0, 10) : todayStr;
      const endStr   = med.endDate   ? med.endDate.slice(0, 10)   : null;

      const isStopped  = med.status === 'stopped';
      const isPast     = isStopped || (!med.isOngoing && endStr && endStr < todayStr);
      const isUpcoming = !isPast && startStr > todayStr;
      const isActive   = !isPast && !isUpcoming;

      // 2. Tab filter
      if (activeTab === 'active' && !isActive) return false;
      if (activeTab === 'upcoming' && !isUpcoming) return false;
      if (activeTab === 'past' && !isPast) return false;

      return true;
    });
  }, [medications, searchQuery, activeTab]);

  function getPastYear(med) {
    if (med.stoppedAt) return new Date(med.stoppedAt).getFullYear();
    if (!med.isOngoing && med.endDate) return new Date(med.endDate).getFullYear();
    if (med.updatedAt) return new Date(med.updatedAt).getFullYear();
    return new Date().getFullYear();
  }

  return (
    <>
      <div className="app-topbar">
        <div className="topbar-title">
          <h2>My Medications</h2>
          <p>View your active, upcoming, and past medications</p>
        </div>
      </div>

      <main className="app-main">
        <div className="card-box" style={{ padding: '24px' }}>
          <div className="meds-header">
            <div className="meds-tabs">
              <button 
                className={`meds-tab ${activeTab === 'active' ? 'active' : ''}`}
                onClick={() => setActiveTab('active')}
              >
                Active
              </button>
              <button 
                className={`meds-tab ${activeTab === 'upcoming' ? 'active' : ''}`}
                onClick={() => setActiveTab('upcoming')}
              >
                Upcoming
              </button>
              <button 
                className={`meds-tab ${activeTab === 'past' ? 'active' : ''}`}
                onClick={() => setActiveTab('past')}
              >
                Past
              </button>
            </div>

            <div className="search-box">
              <svg className="search-icon" stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input 
                type="text" 
                placeholder="Search medications..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="empty-state">Loading medications...</div>
          ) : filteredMeds.length > 0 ? (
            <div className="med-list">
              {filteredMeds.map(med => (
                <div key={med._id} className="med-card">
                  <div className={`med-card-icon ${activeTab}`}>
                    <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
                      <rect x="3" y="10" width="18" height="10" rx="2" ry="2"></rect>
                      <path d="M7 10V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4"></path>
                    </svg>
                  </div>
                  <div className="med-card-info">
                    <h3 className="med-card-title">{med.name}</h3>
                    <p className="med-card-generic">{med.genericName} • {med.dosage}</p>
                    <div className="med-card-details">
                      <div className="med-card-detail">
                        <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        {med.frequency}
                      </div>
                      {activeTab === 'past' && (
                        <div className="med-card-detail" style={{ color: 'var(--gray500)' }}>
                          <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                          </svg>
                          Completed in {getPastYear(med)}
                        </div>
                      )}
                      {activeTab === 'upcoming' && (
                        <div className="med-card-detail" style={{ color: 'var(--teal)' }}>
                          <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                          </svg>
                          Starts {new Date(med.startDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="med-card-actions">
                    {(activeTab === 'active' || activeTab === 'upcoming') && (
                      <button className="med-action-btn edit" onClick={() => setEditingMed(med)}>
                        <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                          <path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                        Edit
                      </button>
                    )}
                    {activeTab === 'active' && (
                      <button className="med-action-btn stop" onClick={() => handleStop(med)}>
                        <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        </svg>
                        Stop
                      </button>
                    )}
                    <button className="med-action-btn delete" onClick={() => handleDelete(med)}>
                      <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                        <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No {activeTab} medications found{searchQuery ? ' matching your search' : ''}.</p>
            </div>
          )}
        </div>
      </main>

      {editingMed && (
        <EditMedicationModal
          med={editingMed}
          onClose={() => setEditingMed(null)}
          onSaved={handleEditSaved}
        />
      )}

      {confirmStop && (
        <div className="modal-overlay" onClick={() => setConfirmStop(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Discontinue Medication</h3>
                <p className="modal-sub">Are you sure you want to stop {confirmStop.name}?</p>
              </div>
              <button className="modal-close" onClick={() => setConfirmStop(null)} type="button">
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--gray600)', margin: '16px 0 24px' }}>
              This medication will be moved to your past history. You can still view it under the Past tab.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" className="btn" style={{ flex: 1, background: 'var(--gray100)', color: 'var(--gray800)' }} onClick={() => setConfirmStop(null)}>Cancel</button>
              <button type="button" className="btn" style={{ flex: 1, background: '#f59e0b', color: '#fff' }} onClick={() => executeStop(confirmStop._id)}>Yes, Stop Medication</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Delete Medication</h3>
                <p className="modal-sub">Permanently delete {confirmDelete.name}?</p>
              </div>
              <button className="modal-close" onClick={() => setConfirmDelete(null)} type="button">
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--gray600)', margin: '16px 0 24px' }}>
              This action cannot be undone. All history and schedule times for this medication will be permanently removed.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" className="btn" style={{ flex: 1, background: 'var(--gray100)', color: 'var(--gray800)' }} onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button type="button" className="btn" style={{ flex: 1, background: 'var(--danger)', color: '#fff' }} onClick={() => executeDelete(confirmDelete._id)}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
