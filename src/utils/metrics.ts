let activeRequests = 0;
let totalRequests = 0;
let totalResponseTimeMs = 0;

export function trackRequestStart() {
  activeRequests += 1;
}

export function trackRequestEnd(durationMs: number) {
  activeRequests = Math.max(0, activeRequests - 1);
  totalRequests += 1;
  totalResponseTimeMs += durationMs;
}

export function getActiveRequestsCount() {
  return activeRequests;
}

export function getAverageResponseTime() {
  if (totalRequests === 0) return 0;
  return parseFloat((totalResponseTimeMs / totalRequests).toFixed(2));
}

export function getTotalRequestsCount() {
  return totalRequests;
}
