import { useState, useEffect, useCallback } from 'react';
import {
  fetchDailyRollup,
  fetchHeartRate,
  fetchHRV,
  fetchSpO2,
  fetchRestingHR,
  fetchActiveZoneMinutes,
  fetchSedentaryTime,
  fetchVo2Max,
  fetchSleep,
  fetchExercise,
  today,
  daysAgo,
} from '../lib/healthApi';

/**
 * Fetches all health data for the dashboard.
 * Handles loading/error states and provides a refresh function.
 */
export function useHealthData(days = 7) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const startDate = daysAgo(days - 1);
  const endDate = today();
  const startTime = `${startDate}T00:00:00Z`;
  const endTime = `${endDate}T23:59:59Z`;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        steps, distance, activeMinutes, calories, sleep, heartRate,
        hrv, spo2, rhr, exercise, activeZoneMinutes, sedentaryTime, vo2Max,
      ] = await Promise.allSettled([
          fetchDailyRollup('steps', startDate, endDate),
          fetchDailyRollup('distance', startDate, endDate),
          fetchDailyRollup('active-minutes', startDate, endDate),
          fetchDailyRollup('calories-in-heart-rate-zone', startDate, endDate),
          fetchSleep(startDate, endDate),
          fetchHeartRate(startTime, endTime),
          fetchHRV(startDate, endDate),
          fetchSpO2(startDate, endDate),
          fetchRestingHR(startDate, endDate),
          fetchExercise(startDate, endDate),
          fetchActiveZoneMinutes(startDate, endDate),
          fetchSedentaryTime(startDate, endDate),
          fetchVo2Max(startDate, endDate),
        ]);

      setData({
        steps: steps.status === 'fulfilled' ? steps.value : null,
        distance: distance.status === 'fulfilled' ? distance.value : null,
        activeMinutes: activeMinutes.status === 'fulfilled' ? activeMinutes.value : null,
        calories: calories.status === 'fulfilled' ? calories.value : null,
        sleep: sleep.status === 'fulfilled' ? sleep.value : null,
        heartRate: heartRate.status === 'fulfilled' ? heartRate.value : null,
        hrv: hrv.status === 'fulfilled' ? hrv.value : null,
        spo2: spo2.status === 'fulfilled' ? spo2.value : null,
        rhr: rhr.status === 'fulfilled' ? rhr.value : null,
        exercise: exercise.status === 'fulfilled' ? exercise.value : null,
        activeZoneMinutes: activeZoneMinutes.status === 'fulfilled' ? activeZoneMinutes.value : null,
        sedentaryTime: sedentaryTime.status === 'fulfilled' ? sedentaryTime.value : null,
        vo2Max: vo2Max.status === 'fulfilled' ? vo2Max.value : null,
        fetchedAt: new Date(),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  return { data, loading, error, refetch: fetchAll };
}

/**
 * Fetch intraday heart rate for a single day (for detailed chart)
 */
export function useIntradayHR(date) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    fetchHeartRate(`${date}T00:00:00Z`, `${date}T23:59:59Z`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [date]);

  return { data, loading };
}
