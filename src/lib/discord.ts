const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;

export async function sendDiscordAlert(message: string) {
  if (!DISCORD_WEBHOOK) return;
  try {
    await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `🚨 **Chest Scanner API Error** 🚨\n\`\`\`json\n${message}\n\`\`\`` })
    });
  } catch (err) {
    console.error("Failed to send discord alert", err);
  }
}
