'use client';

import '../../adherence.css';
import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

const RANGE_OPTIONS = [14, 30, 60];

function formatShortDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
  });
}

function StatCard({ label, value, sub }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-sub">{sub}</div>
    </div>
  );
}

function ChartEmpty({ message }) {
  return <div className="empty-chart">{message}</div>;
}

export default function CaregiverAdherencePage() {
  const [days, setDays] = useState(14);
  const [overview, setOverview] = useState(null);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [patientDetail, setPatientDetail] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchOverview() {
      setLoadingOverview(true);
      setError('');
      try {
        const res = await fetch(`/api/caregiver/adherence?days=${days}`);
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || 'Failed to load adherence overview.');
          return;
        }
        setOverview(json);
        setSelectedPatientId((current) => {
          if (current && json.patients?.some((item) => item.patientId === current)) return current;
          return json.patients?.[0]?.patientId || '';
        });
      } catch {
        setError('Could not load adherence overview.');
      } finally {
        setLoadingOverview(false);
      }
    }

    fetchOverview();
  }, [days]);

  useEffect(() => {
    if (!selectedPatientId) {
      setPatientDetail(null);
      return;
    }

    async function fetchPatientDetail() {
      setLoadingPatient(true);
      try {
        const res = await fetch(`/api/caregiver/patients/${selectedPatientId}/adherence?days=${days}`);
        const json = await res.json();
        if (!res.ok) return;
        setPatientDetail(json);
      } finally {
        setLoadingPatient(false);
      }
    }

    fetchPatientDetail();
  }, [selectedPatientId, days]);

  const patients = overview?.patients || [];
  const rosterSeries = overview?.rosterSeries || [];

  const rosterStats = useMemo(() => {
    if (!patients.length) {
      return {
        avg: 0,
        topPerformer: 'No patients',
        totalMissed: 0,
        trackedPatients: 0,
      };
    }

    const totalAvg = Math.round(patients.reduce((sum, item) => sum + item.averageAdherence, 0) / patients.length);
    const topPerformer = patients[0];

    return {
      avg: totalAvg,
      topPerformer: `${topPerformer.patientName} (${topPerformer.averageAdherence}%)`,
      totalMissed: patients.reduce((sum, item) => sum + item.totalMissed, 0),
      trackedPatients: patients.length,
    };
  }, [patients]);

  return (
    <>
      <div className="app-topbar">
        <div className="topbar-title">
          <h2>Adherence</h2>
          <p>Track trends across your roster and drill into one patient at a time</p>
        </div>
      </div>

      <main className="app-main">
        <div className="adherence-shell">
          <div className="adherence-toolbar">
            <div>
              <div className="adherence-inline-meta">
                <span className="adherence-badge">Roster view</span>
                <span className="adherence-toolbar-note">Compare patients first, then inspect one patient&apos;s daily trend in detail.</span>
              </div>
            </div>
            <div className="adherence-inline-meta">
              <div className="range-group">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`range-chip${days === option ? ' active' : ''}`}
                    onClick={() => setDays(option)}
                  >
                    {option}d
                  </button>
                ))}
              </div>
              <select
                className="adherence-select"
                value={selectedPatientId}
                onChange={(event) => setSelectedPatientId(event.target.value)}
              >
                {patients.map((patient) => (
                  <option key={patient.patientId} value={patient.patientId}>
                    {patient.patientName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loadingOverview ? (
            <div className="adherence-loading">Loading adherence overview…</div>
          ) : error ? (
            <p className="form-error">{error}</p>
          ) : (
            <>
              <div className="metric-grid-wide">
                <StatCard label="Roster average" value={`${rosterStats.avg}%`} sub={`Across the last ${overview?.rangeDays || days} days`} />
                <StatCard label="Tracked patients" value={rosterStats.trackedPatients} sub="Patients with adherence snapshots" />
                <StatCard label="Roster missed doses" value={rosterStats.totalMissed} sub="Combined missed doses in range" />
                <StatCard label="Top performer" value={patients[0]?.averageAdherence ? `${patients[0].averageAdherence}%` : '0%'} sub={rosterStats.topPerformer} />
              </div>

              <div className="charts-grid">
                <section className="chart-card chart-card--full">
                  <div className="chart-head">
                    <div>
                      <h3 className="chart-title">Roster adherence trend</h3>
                      <p className="chart-sub">Combined adherence across all assigned patients for each captured day.</p>
                    </div>
                  </div>
                  {rosterSeries.length ? (
                    <div className="chart-body">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                        <LineChart data={rosterSeries}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="date" tickFormatter={formatShortDate} stroke="#94a3b8" fontSize={12} />
                          <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={12} />
                          <Tooltip labelFormatter={formatShortDate} formatter={(value) => [`${value}%`, 'Roster adherence']} />
                          <Line type="monotone" dataKey="adherencePct" stroke="#0abfb8" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <ChartEmpty message="No roster adherence snapshots are available yet." />
                  )}
                </section>

                <section className="chart-card">
                  <div className="chart-head">
                    <div>
                      <h3 className="chart-title">Patient comparison</h3>
                      <p className="chart-sub">Average adherence by patient for the selected period.</p>
                    </div>
                  </div>
                  {patients.length ? (
                    <div className="chart-body">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                        <BarChart data={patients.slice(0, 8)} layout="vertical" margin={{ left: 18 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" fontSize={12} />
                          <YAxis type="category" dataKey="patientName" width={96} stroke="#94a3b8" fontSize={12} />
                          <Tooltip formatter={(value) => [`${value}%`, 'Average adherence']} />
                          <Bar dataKey="averageAdherence" fill="#0abfb8" radius={[0, 8, 8, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <ChartEmpty message="No patient adherence data is available for this roster." />
                  )}
                </section>

                <section className="chart-card">
                  <div className="chart-head">
                    <div>
                      <h3 className="chart-title">Selected patient detail</h3>
                      <p className="chart-sub">
                        {patientDetail?.patient
                          ? `${patientDetail.patient.firstName} ${patientDetail.patient.lastName}`
                          : 'Choose a patient to inspect their trend'}
                      </p>
                    </div>
                  </div>
                  {loadingPatient ? (
                    <div className="adherence-loading">Loading patient detail…</div>
                  ) : patientDetail?.series?.length ? (
                    <div className="chart-body">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                        <BarChart data={patientDetail.series}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="date" tickFormatter={formatShortDate} stroke="#94a3b8" fontSize={12} />
                          <YAxis stroke="#94a3b8" fontSize={12} />
                          <Tooltip labelFormatter={formatShortDate} />
                          <Legend />
                          <Bar dataKey="takenDoses" name="Taken" fill="#10b981" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="missedDoses" name="Missed" fill="#e84545" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <ChartEmpty message="No patient detail is available yet." />
                  )}
                </section>

                <section className="chart-card">
                  <div className="chart-head">
                    <div>
                      <h3 className="chart-title">Missed medication hotspots</h3>
                      <p className="chart-sub">Which medications are causing the most missed doses for the selected patient.</p>
                    </div>
                  </div>
                  {patientDetail?.medicationMisses?.length ? (
                    <div className="insight-list">
                      {patientDetail.medicationMisses.map((item) => (
                        <div key={item.name} className="insight-row">
                          <div>
                            <div className="insight-title">{item.name}</div>
                            <div className="insight-sub">{item.totalDoses} total scheduled doses in range</div>
                          </div>
                          <span className="insight-pill">{item.missedDoses} missed</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ChartEmpty message="No missed-medication hotspots were found for this patient." />
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}