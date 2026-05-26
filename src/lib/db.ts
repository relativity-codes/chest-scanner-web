import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as fs from "fs";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaInstance: PrismaClient;


let sslConfig = undefined;
try {
  const ca = fs.readFileSync('./.postgresql/root.crt').toString();
  sslConfig = { ca };
} catch {
  console.warn('[DB] .postgresql/root.crt not found, proceeding without custom CA.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
});
const adapter = new PrismaPg(pool);

if (process.env.NODE_ENV === "production") {
  prismaInstance = new PrismaClient({ adapter });
} else {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  prismaInstance = globalForPrisma.prisma;
}

export const db = prismaInstance;
