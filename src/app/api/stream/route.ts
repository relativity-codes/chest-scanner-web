import { NextRequest } from "next/server";
import { eventEmitter, EVENTS } from "@/lib/emitter";

export async function GET(req: NextRequest) {
  const responseStream = new ReadableStream({
    start(controller) {
      // Send standard retry interval and connection ping
      controller.enqueue(new TextEncoder().encode("retry: 1000\n\n"));

      const onChestScanned = (chest: unknown) => {
        const data = `data: ${JSON.stringify(chest)}\n\n`;
        controller.enqueue(new TextEncoder().encode(data));
      };

      eventEmitter.on(EVENTS.CHEST_SCANNED, onChestScanned);

      // Clean up when connection closes
      req.signal.addEventListener("abort", () => {
        eventEmitter.off(EVENTS.CHEST_SCANNED, onChestScanned);
        controller.close();
      });
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
