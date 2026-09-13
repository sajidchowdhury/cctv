/**
 * NextAuth route handler (doc §3.3 auth).
 * Mounts all NextAuth actions under /api/auth/*.
 */
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
