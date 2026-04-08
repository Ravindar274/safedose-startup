import DailyAdherence from '../models/DailyAdherence.js';

function getSafeDayCount(days) {
  const parsed = Number.parseInt(days, 10) || 14;
  return Math.min(90, Math.max(7, parsed));
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function buildDateKeys(days) {
  const result = [];
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() - 1);

  for (let index = days - 1; index >= 0; index -= 1) {
    const current = new Date(end);
    current.setDate(end.getDate() - index);
    result.push(toDateKey(current));
  }

  return result;
}

function formatSeriesRecord(date, record) {
  const totalDoses = record?.totalDoses ?? 0;
  const takenDoses = record?.takenDoses ?? 0;
  const missedDoses = record?.missedDoses ?? 0;

  return {
    date,
    totalDoses,
    takenDoses,
    missedDoses,
    adherencePct: totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0,
  };
}

function buildPatientMedicationMisses(records) {
  const misses = new Map();

  records.forEach((record) => {
    (record.details || []).forEach((detail) => {
      const missedCount = detail.missedIndices?.length || 0;
      if (!missedCount) return;

      const current = misses.get(detail.name) || { name: detail.name, missedDoses: 0, totalDoses: 0 };
      current.missedDoses += missedCount;
      current.totalDoses += detail.totalDoses || 0;
      misses.set(detail.name, current);
    });
  });

  return [...misses.values()]
    .sort((left, right) => right.missedDoses - left.missedDoses)
    .slice(0, 5);
}

export async function getPatientAdherenceSummary(patientId, daysInput) {
  const days = getSafeDayCount(daysInput);
  const dateKeys = buildDateKeys(days);
  const records = await DailyAdherence.find({
    patientId,
    date: { $gte: dateKeys[0], $lte: dateKeys[dateKeys.length - 1] },
  }).sort({ date: 1 });

  const recordMap = new Map(records.map((record) => [record.date, record]));
  const series = dateKeys.map((date) => formatSeriesRecord(date, recordMap.get(date)));

  const totalTaken = series.reduce((sum, item) => sum + item.takenDoses, 0);
  const totalMissed = series.reduce((sum, item) => sum + item.missedDoses, 0);
  const totalDoses = series.reduce((sum, item) => sum + item.totalDoses, 0);
  const activeDays = series.filter((item) => item.totalDoses > 0);
  const overallAdherence = totalDoses > 0 ? Math.round((totalTaken / totalDoses) * 100) : 0;
  const averageAdherence = activeDays.length > 0
    ? Math.round(activeDays.reduce((sum, item) => sum + item.adherencePct, 0) / activeDays.length)
    : 0;
  const bestDay = activeDays.reduce((best, item) => item.adherencePct > (best?.adherencePct ?? -1) ? item : best, null);
  const worstDay = activeDays.reduce((worst, item) => item.adherencePct < (worst?.adherencePct ?? 101) ? item : worst, null);

  return {
    rangeDays: days,
    series,
    stats: {
      overallAdherence,
      averageAdherence,
      totalTaken,
      totalMissed,
      trackedDays: activeDays.length,
      bestDay,
      worstDay,
    },
    medicationMisses: buildPatientMedicationMisses(records),
  };
}

export async function getCaregiverRosterAdherenceSummary(patientIds, patientMeta, daysInput) {
  const days = getSafeDayCount(daysInput);
  const dateKeys = buildDateKeys(days);
  const ids = patientIds.map((item) => String(item));

  const records = await DailyAdherence.find({
    patientId: { $in: patientIds },
    date: { $gte: dateKeys[0], $lte: dateKeys[dateKeys.length - 1] },
  }).sort({ date: 1 });

  const recordsByPatient = new Map(ids.map((id) => [id, []]));
  records.forEach((record) => {
    const key = String(record.patientId);
    const list = recordsByPatient.get(key) || [];
    list.push(record);
    recordsByPatient.set(key, list);
  });

  const patients = ids.map((id) => {
    const patientRecords = recordsByPatient.get(id) || [];
    const trackedDays = patientRecords.filter((record) => record.totalDoses > 0);
    const totalDoses = patientRecords.reduce((sum, record) => sum + (record.totalDoses || 0), 0);
    const takenDoses = patientRecords.reduce((sum, record) => sum + (record.takenDoses || 0), 0);
    const missedDoses = patientRecords.reduce((sum, record) => sum + (record.missedDoses || 0), 0);
    const latest = patientRecords[patientRecords.length - 1] || null;

    return {
      patientId: id,
      patientName: patientMeta.get(id) || 'Unknown patient',
      averageAdherence: totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0,
      trackedDays: trackedDays.length,
      totalMissed: missedDoses,
      latestAdherence: latest?.totalDoses ? Math.round((latest.takenDoses / latest.totalDoses) * 100) : 0,
      latestDate: latest?.date || null,
    };
  }).sort((left, right) => right.averageAdherence - left.averageAdherence);

  const rosterSeries = dateKeys.map((date) => {
    const items = records.filter((record) => record.date === date);
    const totalDoses = items.reduce((sum, record) => sum + (record.totalDoses || 0), 0);
    const takenDoses = items.reduce((sum, record) => sum + (record.takenDoses || 0), 0);
    const missedDoses = items.reduce((sum, record) => sum + (record.missedDoses || 0), 0);

    return {
      date,
      totalDoses,
      takenDoses,
      missedDoses,
      adherencePct: totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0,
    };
  });

  return {
    rangeDays: days,
    rosterSeries,
    patients,
  };
}