// Redis client singleton (used for room state storage)

import Redis from "ioredis";
import { config } from "./config.js";

export const redis = new Redis(config.redisUrl);
