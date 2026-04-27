const durationPattern = /^(\d+)\s*(ms|s|m|h|d|w)?$/i;

const durationUnitToSeconds: Record<string, number> = {
  ms: 0.001,
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
  w: 60 * 60 * 24 * 7,
};

export function durationToSeconds(value: string, fallbackSeconds: number) {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallbackSeconds;
  }

  const directNumber = Number(trimmed);
  if (Number.isFinite(directNumber) && directNumber > 0) {
    return Math.floor(directNumber);
  }

  const match = trimmed.match(durationPattern);
  if (!match) {
    return fallbackSeconds;
  }

  const amount = Number(match[1]);
  const unit = (match[2] ?? "s").toLowerCase();
  const multiplier = durationUnitToSeconds[unit];

  if (!Number.isFinite(amount) || amount <= 0 || !multiplier) {
    return fallbackSeconds;
  }

  return Math.max(1, Math.floor(amount * multiplier));
}

export function durationToFutureDate(value: string, fallbackSeconds: number) {
  const seconds = durationToSeconds(value, fallbackSeconds);
  return new Date(Date.now() + seconds * 1000);
}