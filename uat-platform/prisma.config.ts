import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 does not read .env on its own.
config({ quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
