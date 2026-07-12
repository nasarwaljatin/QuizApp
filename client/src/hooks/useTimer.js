import { useState, useEffect, useRef } from 'react';

/**
 * useTimer - countdown hook
 * @param {number} durationSeconds - total seconds to count down from
 * @param {boolean} active - whether timer is running
 * @returns {{ timeLeft: number, formattedTime: string, isTimeUp: boolean, percentLeft: number }}
 */
export function useTimer(durationSeconds, active = true) {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [prevDuration, setPrevDuration] = useState(durationSeconds);
  const intervalRef = useRef(null);

  if (durationSeconds !== prevDuration) {
    setTimeLeft(durationSeconds);
    setPrevDuration(durationSeconds);
  }


  useEffect(() => {
    if (!active || timeLeft <= 0) {
      clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [active, durationSeconds]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isTimeUp = timeLeft === 0;
  const percentLeft = durationSeconds > 0 ? (timeLeft / durationSeconds) * 100 : 0;

  return { timeLeft, formattedTime, isTimeUp, percentLeft };
}
