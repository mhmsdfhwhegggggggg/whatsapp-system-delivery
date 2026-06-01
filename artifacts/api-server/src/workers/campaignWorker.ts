import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queues/config';
import { db, campaignsTable, messageLogsTable, sessionsTable } from '@workspace/db';
import { eq, and, sql } from 'drizzle-orm';
import { sendMessage, isSessionConnected } from '../whatsapp/manager';
import { 
  applyVariation, 
  substituteVariables, 
  humanTypingDelay, 
  randomDelay, 
  sleep, 
  recordSessionFailure, 
  resetSessionFailures 
} from '../whatsapp/antiban';
import { logger } from '../logger';

export const campaignWorker = new Worker(
  'campaign-messages',
  async (job: Job) => {
    const { campaignId, messageLogId } = job.data;

    // 1. Fetch data
    const [log] = await db.select().from(messageLogsTable).where(eq(messageLogsTable.id, messageLogId));
    const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId));

    if (!log || !campaign || campaign.status !== 'running') return;

    // 2. Account Rotation Logic: Find best available session
    const availableSessions = await db.select().from(sessionsTable).where(eq(sessionsTable.status, 'connected'));
    if (availableSessions.length === 0) {
      throw new Error('No connected sessions available for rotation');
    }

    // Simple Round Robin or Random rotation
    const session = availableSessions[Math.floor(Math.random() * availableSessions.length)];
    const sessionId = session.id;

    try {
      // 3. Prepare message
      let messageText = log.contactName ? `Hello ${log.contactName}` : "Hello";
      // (Actual template logic would go here)
      
      if (campaign.enableVariation) {
        messageText = applyVariation(messageText, log.id);
      }

      // 4. Human behavior simulation
      await sleep(humanTypingDelay(messageText.length));

      // 5. Send
      const result = await sendMessage(sessionId, log.phone, messageText);

      if (result.ok) {
        await db.update(messageLogsTable)
          .set({ status: 'delivered', sentAt: new Date() })
          .where(eq(messageLogsTable.id, log.id));
        
        await db.update(campaignsTable)
          .set({ 
            sentCount: sql`${campaignsTable.sentCount} + 1`,
            deliveredCount: sql`${campaignsTable.deliveredCount} + 1` 
          })
          .where(eq(campaignsTable.id, campaignId));
        
        await resetSessionFailures(sessionId);
      } else {
        throw new Error(result.error || 'Failed to send');
      }

    } catch (error: any) {
      logger.error({ error, campaignId, messageLogId }, "Worker error");
      
      await db.update(messageLogsTable)
        .set({ status: 'failed', errorMessage: error.message })
        .where(eq(messageLogsTable.id, log.id));
      
      await recordSessionFailure(sessionId);
      throw error;
    }
  },
  { connection: redisConnection, concurrency: 5 } // Process 5 messages in parallel
);
