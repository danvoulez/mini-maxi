import { createClient, type RedisClientType } from "redis";

let client: RedisClientType | null = null;

export async function getRedis(): Promise<RedisClientType | null> {
  if (!process.env.REDIS_URL) return null;
  if (client) return client;
  client = createClient({ url: process.env.REDIS_URL });
  client.on("error", () => {});
  await client.connect().catch(() => {});
  return client;
}
