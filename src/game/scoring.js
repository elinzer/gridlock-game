export function compareResults(a, b) {
  if (a.overPar !== b.overPar) return a.overPar - b.overPar;
  return b.timeLeftMs - a.timeLeftMs;
}

export function formatOverPar(n) {
  return n === 0 ? 'PAR' : '+' + n;
}

export function formatClock(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const secs = total % 60;
  return Math.floor(total / 60) + ':' + (secs < 10 ? '0' : '') + secs;
}
