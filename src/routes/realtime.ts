import { Elysia } from "elysia";
import { Effect, ManagedRuntime } from "effect";
import { RealtimeService } from "../services/realtime.ts";

const connectedUsers = new Set<string>();
let broadcastInterval: Timer | null = null;
const subscribers = new Set<any>();

const broadcastUsers = async (runtime: ManagedRuntime.ManagedRuntime<RealtimeService, never>) => {
  try {
    const program = RealtimeService.pipe(Effect.flatMap((service) => service.getOnlineUsers()));

    const allUsers = await runtime.runPromise(program);

    const onlineUsers = allUsers.filter(user => connectedUsers.has(user.discordId));

    const message = JSON.stringify({
      type: "online_users",
      users: onlineUsers,
    });

    for (const ws of subscribers) {
      try {
        ws.send(message);
      } catch (error) {
        console.error("Error sending to WebSocket:", error);
      }
    }
  } catch (error) {
    console.error("Error fetching online users:", error);
  }
};

export const createRealtimeRoutes = (
  runtime: ManagedRuntime.ManagedRuntime<RealtimeService, never>,
) =>
  new Elysia().ws("/ws", {
    async open(ws) {
      subscribers.add(ws);
      console.log(`WebSocket client connected (${subscribers.size} total)`);

      if (!broadcastInterval) {
        broadcastInterval = setInterval(() => broadcastUsers(runtime), 5000);
      }

      await broadcastUsers(runtime);
    },

    message(ws, message) {
      if (typeof message === "string") {
        try {
          const data = JSON.parse(message);
          if (data.type === "heartbeat" && data.discordId) {
            connectedUsers.add(data.discordId);
            setTimeout(() => {
              if (!subscribers.has(ws)) {
                connectedUsers.delete(data.discordId);
              }
            }, 10000);
          }
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);}
      }
    },

    close(ws) {
      subscribers.delete(ws);
      console.log(`WebSocket client disconnected (${subscribers.size} remaining)`);

      if (subscribers.size === 0 && broadcastInterval) {
        clearInterval(broadcastInterval);
        broadcastInterval = null;
        connectedUsers.clear();
      }

      if (subscribers.size > 0) {
        broadcastUsers(runtime);
      }
    },
  });
