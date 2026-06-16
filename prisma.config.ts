import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Gagamitin natin ang aws-1 pooler host na may kasamang project reference ID sa username
    url: "postgresql://postgres.xjfbrjyvinljseqbbika:SupabaseAdmin%4099@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1",
  },
});