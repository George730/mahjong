// Server configuration loaded from environment variables (with dev defaults)

import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  databaseUrl: process.env.DATABASE_URL || "postgresql://mahjong:mahjong@localhost:5432/mahjong",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
};
