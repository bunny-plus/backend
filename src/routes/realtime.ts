import { Elysia } from "elysia";
import { Effect, ManagedRuntime } from "effect";
import { RealtimeService } from "../services/realtime.ts";

export const createRealtimeRoutes = (
  runtime: ManagedRuntime.ManagedRuntime<RealtimeService, never>,
) =>
  new Elysia().ws("/ws", {
    open(ws) {
      console.log("WebSocket client connected");

      const sendUsers = async () => {
        try {
          const program = RealtimeService.pipe(
            Effect.flatMap((service) => service.getOnlineUsers()),
          );

          const users = await runtime.runPromise(program);

          ws.send(
            JSON.stringify({
              type: "online_users",
              users,
            }),
          );
        } catch (error) {
          console.error("Error fetching online users:", error);
        }
      };

      sendUsers();

      const interval = setInterval(sendUsers, 5000);

      (ws as any).updateInterval = interval;
    },

    message(ws, message) {
      console.log("Received message:", message);
    },

    close(ws) {
      console.log("WebSocket client disconnected");

      const interval = (ws as any).updateInterval;
      if (interval) {
        clearInterval(interval);
      }
    },
  });
