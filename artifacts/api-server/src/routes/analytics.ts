import { Router } from "express";
import { db } from "@workspace/db";
import { campaignsTable, contactsTable, contactGroupsTable, sessionsTable, messageLogsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";

const router = Router();

router.get("/analytics/overview", async (req, res) => {
  try {
    const [campaignStats] = await db
      .select({
        totalCampaigns: sql<number>`count(*)::int`,
        activeCampaigns: sql<number>`count(*) filter (where status = 'running')::int`,
        totalMessagesSent: sql<number>`coalesce(sum(sent_count), 0)::int`,
        totalDelivered: sql<number>`coalesce(sum(delivered_count), 0)::int`,
        totalFailed: sql<number>`coalesce(sum(failed_count), 0)::int`,
      })
      .from(campaignsTable);

    const [contactStats] = await db
      .select({ totalContacts: sql<number>`count(*)::int` })
      .from(contactsTable);

    const [sessionStats] = await db
      .select({ connectedSessions: sql<number>`count(*) filter (where status = 'connected')::int` })
      .from(sessionsTable);

    const sent = campaignStats?.totalMessagesSent ?? 0;
    const delivered = campaignStats?.totalDelivered ?? 0;
    const successRate = sent > 0 ? Math.round((delivered / sent) * 100 * 10) / 10 : 0;

    res.json({
      totalCampaigns: campaignStats?.totalCampaigns ?? 0,
      activeCampaigns: campaignStats?.activeCampaigns ?? 0,
      totalMessagesSent: sent,
      totalDelivered: delivered,
      totalFailed: campaignStats?.totalFailed ?? 0,
      totalContacts: contactStats?.totalContacts ?? 0,
      successRate,
      connectedSessions: sessionStats?.connectedSessions ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get analytics overview");
    res.status(500).json({ error: "Failed to get analytics overview" });
  }
});

router.get("/analytics/campaigns", async (req, res) => {
  try {
    const campaigns = await db
      .select()
      .from(campaignsTable)
      .orderBy(campaignsTable.createdAt);

    res.json(
      campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        sentCount: c.sentCount,
        deliveredCount: c.deliveredCount,
        failedCount: c.failedCount,
        totalCount: c.totalCount,
        successRate: c.sentCount > 0 ? Math.round((c.deliveredCount / c.sentCount) * 100 * 10) / 10 : 0,
        createdAt: c.createdAt,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get campaign stats");
    res.status(500).json({ error: "Failed to get campaign stats" });
  }
});

export default router;
