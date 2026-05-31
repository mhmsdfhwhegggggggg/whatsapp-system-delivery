import { Router } from "express";
import { db } from "@workspace/db";
import { templatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateTemplateBody,
  UpdateTemplateParams,
  UpdateTemplateBody,
  DeleteTemplateParams,
} from "@workspace/api-zod";
const GetTemplateParams = DeleteTemplateParams;

const router = Router();

function extractVariables(content: string): string[] {
  const matches = content.matchAll(/\{\{(\w+)\}\}/g);
  const vars = new Set<string>();
  for (const m of matches) vars.add(m[1]);
  return [...vars];
}

router.get("/templates", async (req, res) => {
  try {
    const templates = await db.select().from(templatesTable).orderBy(templatesTable.createdAt);
    res.json(templates.map((t) => ({ ...t, variables: extractVariables(t.content) })));
  } catch (err) {
    req.log.error({ err }, "Failed to list templates");
    res.status(500).json({ error: "Failed to list templates" });
  }
});

router.post("/templates", async (req, res) => {
  const parsed = CreateTemplateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [template] = await db
      .insert(templatesTable)
      .values({
        name: parsed.data.name,
        content: parsed.data.content,
        mediaType: parsed.data.mediaType ?? null,
        mediaUrl: parsed.data.mediaUrl ?? null,
      })
      .returning();
    res.status(201).json({ ...template, variables: extractVariables(template.content) });
  } catch (err) {
    req.log.error({ err }, "Failed to create template");
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.get("/templates/:id", async (req, res) => {
  const parsed = GetTemplateParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, parsed.data.id));
    if (!template) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...template, variables: extractVariables(template.content) });
  } catch (err) {
    req.log.error({ err }, "Failed to get template");
    res.status(500).json({ error: "Failed to get template" });
  }
});

router.patch("/templates/:id", async (req, res) => {
  const paramsParsed = UpdateTemplateParams.safeParse({ id: Number(req.params.id) });
  const bodyParsed = UpdateTemplateBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const updates: Partial<typeof templatesTable.$inferInsert> = {};
    if (bodyParsed.data.name !== undefined) updates.name = bodyParsed.data.name;
    if (bodyParsed.data.content !== undefined) updates.content = bodyParsed.data.content;
    if (bodyParsed.data.mediaType !== undefined) updates.mediaType = bodyParsed.data.mediaType;
    if (bodyParsed.data.mediaUrl !== undefined) updates.mediaUrl = bodyParsed.data.mediaUrl;

    const [template] = await db
      .update(templatesTable)
      .set(updates)
      .where(eq(templatesTable.id, paramsParsed.data.id))
      .returning();
    if (!template) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...template, variables: extractVariables(template.content) });
  } catch (err) {
    req.log.error({ err }, "Failed to update template");
    res.status(500).json({ error: "Failed to update template" });
  }
});

router.delete("/templates/:id", async (req, res) => {
  const parsed = DeleteTemplateParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.delete(templatesTable).where(eq(templatesTable.id, parsed.data.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete template");
    res.status(500).json({ error: "Failed to delete template" });
  }
});

export default router;
