'use client';

import '../patient-dashboard.css';
import './schedule.css';
import { useEffect, useMemo, useState } from 'react';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isSameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function toDateKey(date) {
  return startOfDay(date).toISOString().slice(0, 10);
}

function fromStoredDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function getMonthLabel(date) {
  return date.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
}

function parseTime(timeStr) {
  if (!timeStr) return null;
  const [t, period] = timeStr.split(' ');
  let [h, m] = t.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function getDoseStatus(timeStr, nextTimeStr, taken) {
  if (taken) return 'taken';
  const now = new Date();
  const scheduled = parseTime(timeStr);
  if (!scheduled || now < scheduled) return 'upcoming';
  if (nextTimeStr) {
    const next = parseTime(nextTimeStr);
    if (next && now >= next) return 'missed';
  }
  return 'due';
}

function statusLabel(status) {
  if (status === 'taken') return 'Taken';
  if (status === 'missed') return 'Missed';
  if (status === 'due') return 'Due now';
  if (status === 'scheduled') return 'Scheduled';
  return 'Upcoming';
}

function occursOnDate(med, date) {
  const target = startOfDay(date);
  const start = fromStoredDate(med.startDate) || startOfDay(new Date());
  if (target < start) return false;

  const stoppedAt = fromStoredDate(med.stoppedAt);
  if (med.status === 'stopped' && stoppedAt && target > stoppedAt) return false;

  if (!med.isOngoing) {
    const end = fromStoredDate(med.endDate);
    if (end && target > end) return false;
  }

  const diffDays = Math.floor((target.getTime() - start.getTime()) / 86400000);
  if (diffDays < 0) return false;

  if (med.frequency === 'once every 2 days') return diffDays % 2 === 0;
  if (med.frequency === 'once every 3 days') return diffDays % 3 === 0;
  if (med.frequency === 'once in a week') return diffDays % 7 === 0;

  return true;
}

function buildCalendarDays(currentMonth) {
  const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export default function PatientSchedulePage() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [medications, setMedications] = useState([]);
  const [allMedications, setAllMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyDose, setBusyDose] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  useEffect(() => {
    async function loadSchedule() {
      setLoading(true);
      setError('');
      try {
        const [todayRes, allRes] = await Promise.all([
          fetch('/api/patient/medications/today'),
          fetch('/api/patient/medications'),
        ]);

        const [todayJson, allJson] = await Promise.all([todayRes.json(), allRes.json()]);

        if (!todayRes.ok || !allRes.ok) {
          setError(todayJson.error || allJson.error || 'Failed to load schedule.');
          return;
        }

        setMedications(todayJson.medications || []);
        setAllMedications(allJson.medications || []);
      } catch {
        setError('Could not load schedule.');
      } finally {
        setLoading(false);
      }
    }

    loadSchedule();
  }, []);

  const selectedDayMeds = useMemo(() => {
    if (isSameDay(selectedDate, today)) return medications;
    return allMedications.filter((med) => occursOnDate(med, selectedDate));
  }, [allMedications, medications, selectedDate, today]);

  const events = useMemo(() => {
    const flat = [];

    selectedDayMeds.forEach((med) => {
      const times = med.scheduleTimes || [];
      times.forEach((timeStr, idx) => {
        const taken = isSameDay(selectedDate, today) ? Boolean(med.takenToday?.[idx]) : false;
        const status = isSameDay(selectedDate, today)
          ? getDoseStatus(timeStr, times[idx + 1], taken)
          : 'scheduled';
        flat.push({
          id: `${med._id}-${idx}`,
          medId: med._id,
          doseIndex: idx,
          medicationName: med.name,
          dosage: med.dosage,
          time: timeStr,
          status,
          taken,
          genericName: med.genericName,
        });
      });
    });

    flat.sort((a, b) => {
      const ta = parseTime(a.time)?.getTime() || 0;
      const tb = parseTime(b.time)?.getTime() || 0;
      return ta - tb;
    });

    return flat;
  }, [selectedDayMeds, selectedDate, today]);

  const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);

  const daySummaries = useMemo(() => {
    const map = new Map();
    calendarDays.forEach((date) => {
      const medsForDate = allMedications.filter((med) => occursOnDate(med, date));
      const doseCount = medsForDate.reduce((sum, med) => sum + (med.scheduleTimes?.length || 0), 0);
      map.set(toDateKey(date), {
        meds: medsForDate.length,
        doses: doseCount,
      });
    });
    return map;
  }, [allMedications, calendarDays]);

  const stats = useMemo(() => {
    return events.reduce(
      (acc, event) => {
        acc.total += 1;
        if (event.status === 'taken') acc.taken += 1;
        else if (event.status === 'due') acc.due += 1;
        else if (event.status === 'missed') acc.missed += 1;
        else acc.upcoming += 1;
        return acc;
      },
      { total: 0, taken: 0, due: 0, missed: 0, upcoming: 0 }
    );
  }, [events]);

  async function handleToggleTaken(medId, doseIndex) {
    const key = `${medId}-${doseIndex}`;
    setBusyDose(key);
    try {
      const res = await fetch(`/api/patient/medications/${medId}/taken`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doseIndex }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to update dose status.');
        return;
      }

      setMedications((prev) =>
        prev.map((med) =>
          med._id === medId
            ? { ...med, takenToday: json.takenToday, allTaken: json.allTaken }
            : med
        )
      );
    } catch {
      setError('Failed to update dose status.');
    } finally {
      setBusyDose('');
    }
  }

  return (
    <>
      <div className="app-topbar">
        <div className="topbar-title">
          <h2>Schedule</h2>
          <p>Calendar-based medication schedule with daily dose timeline</p>
        </div>
      </div>

      <main className="app-main">
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-val">{stats.total}</div>
            <div className="stat-lbl">Doses on selected day</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{stats.taken}</div>
            <div className="stat-lbl">Taken</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{stats.due}</div>
            <div className="stat-lbl">Due now</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{stats.missed}</div>
            <div className="stat-lbl">Missed</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{stats.upcoming}</div>
            <div className="stat-lbl">Upcoming</div>
          </div>
        </div>

        <div className="card-box">
          <div className="section-hdr">
            <h3>Medication Calendar</h3>
            <div className="calendar-nav">
              <button
                type="button"
                className="calendar-nav-btn"
                onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              >
                Prev
              </button>
              <span className="calendar-month-label">{getMonthLabel(currentMonth)}</span>
              <button
                type="button"
                className="calendar-nav-btn"
                onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              >
                Next
              </button>
            </div>
          </div>

          <div className="calendar-grid">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="calendar-weekday">{label}</div>
            ))}
            {calendarDays.map((date) => {
              const key = toDateKey(date);
              const summary = daySummaries.get(key) || { meds: 0, doses: 0 };
              const isOutsideMonth = date.getMonth() !== currentMonth.getMonth();
              const isSelected = isSameDay(date, selectedDate);
              const isTodayCell = isSameDay(date, today);

              return (
                <button
                  key={key}
                  type="button"
                  className={`calendar-day${isOutsideMonth ? ' calendar-day--outside' : ''}${isSelected ? ' calendar-day--selected' : ''}${isTodayCell ? ' calendar-day--today' : ''}`}
                  onClick={() => setSelectedDate(startOfDay(date))}
                >
                  <span className="calendar-day-num">{date.getDate()}</span>
                  <span className="calendar-day-meta">{summary.doses ? `${summary.doses} doses` : 'No doses'}</span>
                  {summary.meds > 0 && <span className="calendar-day-chip">{summary.meds} meds</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="card-box">
          <div className="section-hdr">
            <h3>{isSameDay(selectedDate, today) ? "Today's Dose Timeline" : 'Selected Day Timeline'}</h3>
            <span className="schedule-date">
              {selectedDate.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>

          {loading ? (
            <p className="schedule-muted">Loading schedule...</p>
          ) : error ? (
            <p className="form-error">{error}</p>
          ) : events.length === 0 ? (
            <p className="schedule-muted">No doses scheduled for this day.</p>
          ) : (
            <div className="timeline">
              {events.map((event) => (
                <div key={event.id} className={`timeline-item timeline-item--${event.status}`}>
                  <div className="timeline-time">{event.time}</div>
                  <div className="timeline-body">
                    <h4>{event.medicationName}</h4>
                    <p>{event.genericName || 'No generic name'} • {event.dosage}</p>
                  </div>
                  <div className="timeline-actions">
                    <span className={`status-badge status-${event.status}`}>{statusLabel(event.status)}</span>
                    {isSameDay(selectedDate, today) ? (
                      <button
                        type="button"
                        className={`timeline-toggle-btn${event.taken ? ' timeline-toggle-btn--taken' : ''}`}
                        onClick={() => handleToggleTaken(event.medId, event.doseIndex)}
                        disabled={busyDose === event.id || event.status === 'upcoming'}
                        title={event.status === 'upcoming' ? 'Dose time has not started yet' : event.taken ? 'Unmark this dose' : 'Mark this dose as taken'}
                      >
                        {busyDose === event.id ? 'Saving...' : event.taken ? 'Undo' : 'Mark taken'}
                      </button>
                    ) : (
                      <span className="timeline-readonly">Preview</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
