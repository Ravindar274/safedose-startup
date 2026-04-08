// src/lib/mongodb.js

import mongoose from 'mongoose';

let isConnected = false;

export async function connectDB() {
  if (isConnected) return;

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in .env');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  isConnected = true;
  console.log('[MongoDB] Connected');
}