export interface Env {
  APP_URL: string;
  CRON_SECRET: string;
  DISCORD_WEBHOOK_URL?: string;
}

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const appUrl = env.APP_URL;

    // 1. Health check — don't attempt sync if app is unreachable
    try {
      const healthRes = await fetch(`${appUrl}/api/health`, {
        signal: AbortSignal.timeout(10_000),
      });

      if (!healthRes.ok) {
        console.error(`[Health] Unhealthy: ${healthRes.status}`);
        await sendAlert(env, `App unhealthy: HTTP ${healthRes.status}`);
        return;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Health check failed";
      console.error(`[Health] Error: ${msg}`);
      await sendAlert(env, `App unreachable: ${msg}`);
      return;
    }

    // 2. Trigger sync
    try {
      const syncRes = await fetch(`${appUrl}/api/cron/sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CRON_SECRET}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(30_000),
      });

      if (!syncRes.ok) {
        const body = await syncRes.text();
        console.error(`[Sync] Failed: ${syncRes.status} — ${body}`);
        await sendAlert(env, `Sync failed: HTTP ${syncRes.status} — ${body}`);
      } else {
        console.log(`[Sync] OK at ${new Date().toISOString()}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Sync request failed";
      console.error(`[Sync] Error: ${msg}`);
      await sendAlert(env, `Sync error: ${msg}`);
    }
  },
};

async function sendAlert(env: Env, message: string): Promise<void> {
  if (!env.DISCORD_WEBHOOK_URL) {
    console.warn(`[Alert] No DISCORD_WEBHOOK_URL set. Message: ${message}`);
    return;
  }

  try {
    await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `**[AGILA Sync Alert]** ${message}`,
      }),
    });
  } catch (error) {
    console.error("[Alert] Failed to send Discord alert:", error);
  }
}
