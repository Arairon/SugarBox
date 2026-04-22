import env from "./env";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaBunSQLite } from '@synapsenwerkstatt/prisma-bun-sqlite-adapter'

const adapter = new PrismaBunSQLite({
  url: env.DATABASE_URL
})

export const db = new PrismaClient({ adapter });
