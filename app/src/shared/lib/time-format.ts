export function formatMillisecondsClock(valueMs: number): string {
  const totalMs = Math.max(0, Number.isFinite(valueMs) ? Math.round(valueMs) : 0)
  const totalSeconds = Math.floor(totalMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const milliseconds = totalMs % 1000

  return `${padTimeUnit(hours)}:${padTimeUnit(minutes)}:${padTimeUnit(seconds)}.${padMillisecondUnit(milliseconds)}`
}

export function formatMillisecondsClockRange(startMs: number, endMs: number): string {
  return `${formatMillisecondsClock(startMs)} - ${formatMillisecondsClock(endMs)}`
}

function padTimeUnit(value: number): string {
  return String(value).padStart(2, '0')
}

function padMillisecondUnit(value: number): string {
  return String(value).padStart(3, '0')
}
