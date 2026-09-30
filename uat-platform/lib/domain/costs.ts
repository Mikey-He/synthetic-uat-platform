import type { Fixture } from "./types";

// Every cost a participant sees comes from fixture.monthlyCosts, and "this
// month" is the month of fixture.today, never the real clock.

export function currentMonth(fixture: Fixture) {
  return fixture.today.slice(0, 7);
}

export function costMonths(fixture: Fixture) {
  const months = new Set<string>();
  for (const costs of Object.values(fixture.monthlyCosts)) {
    for (const cost of costs) months.add(cost.month);
  }
  return [...months].sort();
}

export function projectCost(fixture: Fixture, projectId: string, month: string) {
  return fixture.monthlyCosts[projectId]?.find((cost) => cost.month === month)?.usd ?? 0;
}

export function totalCost(fixture: Fixture, projectIds: string[], month: string) {
  return projectIds.reduce((sum, id) => sum + projectCost(fixture, id, month), 0);
}
