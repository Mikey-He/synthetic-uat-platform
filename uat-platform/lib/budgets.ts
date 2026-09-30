import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { budgetConfigSchema, draftBodySchema } from "@/lib/domain/schemas";
import type { BudgetConfig } from "@/lib/domain/types";
import { evaluate } from "@/lib/evaluator/evaluate";
import { fixture } from "@/lib/fixtures";

// Server only. Drafts and budgets are keyed by the session token until step 5.

export type Draft = { config: BudgetConfig; editingBudgetId: string | null };
export type SavedBudget = { id: string; version: number; config: BudgetConfig; savedAt: Date };

// JSON round trip: drops undefined keys and stores NaN as null.
const toJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export async function getDraft(token: string): Promise<Draft | null> {
  const row = await db.budgetDraft.findUnique({ where: { token } });
  if (!row) return null;
  const parsed = draftBodySchema.safeParse(row.draft);
  return parsed.success ? parsed.data : null;
}

export async function putDraft(token: string, draft: Draft) {
  const json = toJson(draft);
  await db.budgetDraft.upsert({
    where: { token },
    create: { token, draft: json },
    update: { draft: json },
  });
}

const toSaved = (row: { id: string; version: number; config: unknown; savedAt: Date }) => ({
  id: row.id,
  version: row.version,
  config: budgetConfigSchema.parse(row.config),
  savedAt: row.savedAt,
});

// Latest version of each budget, most recently saved first.
export async function listBudgets(token: string): Promise<SavedBudget[]> {
  const rows = await db.budget.findMany({
    where: { token },
    orderBy: [{ savedAt: "desc" }, { version: "desc" }],
  });
  const latest = new Map<string, SavedBudget>();
  for (const row of rows) if (!latest.has(row.id)) latest.set(row.id, toSaved(row));
  return [...latest.values()];
}

export async function getBudget(token: string, id: string): Promise<SavedBudget | null> {
  const row = await db.budget.findFirst({ where: { token, id }, orderBy: { version: "desc" } });
  return row ? toSaved(row) : null;
}

// Writes a new version row (a new budget, or the next version of the one being
// edited), scores it, and clears the draft. The evaluation never leaves the server.
export async function saveBudget(token: string, config: BudgetConfig, editingBudgetId: string | null) {
  return db.$transaction(async (tx) => {
    const edited = editingBudgetId
      ? await tx.budget.findFirst({
          where: { token, id: editingBudgetId },
          orderBy: { version: "desc" },
        })
      : null;
    const id = edited?.id ?? randomUUID();
    const version = (edited?.version ?? 0) + 1;

    await tx.budget.create({ data: { id, version, token, config: toJson(config) } });

    const result = evaluate(config, true, fixture);
    await tx.evaluation.create({
      data: {
        token,
        budgetId: id,
        budgetVersion: version,
        criteria: toJson(result.criteria),
        overallSuccess: result.overall,
        resolvedRecipients: toJson(result.people),
        recipientMechanisms: toJson(Object.fromEntries(result.people.map((p) => [p.id, p.via]))),
        evaluatorVersion: result.version,
      },
    });

    await tx.budgetDraft.deleteMany({ where: { token } });
    return { id, version };
  });
}
