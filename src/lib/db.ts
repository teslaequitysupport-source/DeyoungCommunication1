import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client"

// Prisma client singleton with a schema stamp. In dev, the generated client
// changes whenever prisma/schema.prisma is pushed; a process-lifetime global
// would keep serving a stale schema (observed as "Null constraint violation
// on updatedAt"). The stamp forces a fresh client when the schema file or the
// generated client changes.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaStamp: string | undefined
}

function currentStamp(): string {
  try {
    const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
    const genPath = path.join(process.cwd(), "node_modules", ".prisma", "client", "schema.prisma");
    const a = fs.statSync(schemaPath).mtimeMs;
    const b = fs.existsSync(genPath) ? fs.statSync(genPath).mtimeMs : 0;
    return `${a}:${b}`;
  } catch {
    return "no-stamp";
  }
}

function getClient(): PrismaClient {
  const stamp = currentStamp();
  if (globalForPrisma.prisma && globalForPrisma.prismaStamp === stamp) {
    return globalForPrisma.prisma;
  }
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });
  globalForPrisma.prisma = client;
  globalForPrisma.prismaStamp = stamp;
  return client;
}

export const db = getClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
