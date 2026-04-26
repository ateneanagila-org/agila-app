export async function sendSyncAlert(message: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[DiscordAlert] DISCORD_WEBHOOK_URL not set. Message:", message);
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `**[AGILA Sync Alert]** ${message}`,
      }),
    });
  } catch (error) {
    console.error("[DiscordAlert] Failed to send:", error);
  }
}
