import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Single PrismaClient instance, reused across the app (module caching keeps
// this a singleton — never instantiate PrismaClient per-request).
export const prisma = new PrismaClient({ adapter });
