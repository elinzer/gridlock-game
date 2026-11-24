import { IDLE } from '../config.js';

export function idleStatus(lastTouchAt, now) {
  const idleFor = now - lastTouchAt;
  if (idleFor < IDLE.warnMs) return { status: 'active', secondsLeft: IDLE.graceMs / 1000 };
  const left = IDLE.warnMs + IDLE.graceMs - idleFor;
  if (left <= 0) return { status: 'expired', secondsLeft: 0 };
  return { status: 'warning', secondsLeft: Math.ceil(left / 1000) };
}
