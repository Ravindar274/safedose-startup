// src/models/DailyAdherence.js

import mongoose from 'mongoose';

/**
 * Stores a patient's daily medication adherence snapshot.
 * Captured once per day at 23:59 by the scheduled job in index.js.
 *
 * date       — "YYYY-MM-DD" string (the day this record covers)
 * totalDoses — total doses scheduled that day
 * takenDoses — doses marked as taken
 * missedDoses — doses that were due but not taken
 * details    — per-medication breakdown for drill-down analysis
 */
const DailyAdherenceSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    date: {
      type: String,   // "YYYY-MM-DD"
      required: true,
    },
    totalDoses:  { type: Number, default: 0 },
    takenDoses:  { type: Number, default: 0 },
    missedDoses: { type: Number, default: 0 },
    details: [
      {
        medicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medication' },
        name:         String,
        totalDoses:   Number,
        takenDoses:   Number,
        missedIndices: [Number],   // which dose indices were missed
      },
    ],
  },
  { timestamps: true }
);

// One record per patient per day
DailyAdherenceSchema.index({ patientId: 1, date: 1 }, { unique: true });

export default mongoose.models.DailyAdherence ||
  mongoose.model('DailyAdherence', DailyAdherenceSchema);
