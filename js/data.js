/**
 * Data layer — single entry point for trip data.
 *
 * Version 1: loads from data/trip.json
 * Future: swap fetchTripData() implementation to use Supabase client
 */

let cachedData = null;

export async function fetchTripData() {
  if (cachedData) return cachedData;

  const response = await fetch('/data/trip.json');

  if (!response.ok) {
    throw new Error(`Failed to load trip data (${response.status})`);
  }

  cachedData = await response.json();
  return cachedData;
}

export function clearCache() {
  cachedData = null;
}
