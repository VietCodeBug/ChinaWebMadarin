import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./drizzle";
import { headers } from "next/headers";

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
    }),
    baseURL: process.env.NODE_ENV === 'development' 
        ? "http://localhost:3000" 
        : (process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")),
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
    },
    user: {
        additionalFields: {
            exp: {
                type: "number",
                defaultValue: 0
            },
            maxCombo: {
                type: "number",
                defaultValue: 0
            },
            streak: {
                type: "number",
                defaultValue: 1
            },
            lastActive: {
                type: "date"
            }
        }
    }
});

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  exp: number;
  max_combo: number;
  streak: number;
  image?: string | null;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const session = await auth.api.getSession({
      headers: headers()
    });
    if (!session || !session.user) return null;
    
    const userObj: User = {
      id: session.user.id,
      email: session.user.email,
      display_name: session.user.name,
      exp: (session.user as any).exp ?? 0,
      max_combo: (session.user as any).maxCombo ?? 0,
      streak: Math.max(1, (session.user as any).streak ?? 1),
      image: session.user.image,
    };
    
    // Auto-update streak if needed
    await updateStreakIfNeeded(userObj, (session.user as any).lastActive);
    
    return userObj;
  } catch (e) {
    console.error("Better Auth getCurrentUser error:", e);
    return null;
  }
}

import { sql } from "drizzle-orm";

async function updateStreakIfNeeded(user: User, lastActiveVal: any) {
  const now = new Date();
  if (!lastActiveVal) {
    try {
      await db.execute(
        sql`UPDATE "user" SET streak = 1, last_active = NOW() WHERE id = ${user.id}`
      );
      user.streak = 1;
    } catch (_) {}
    return;
  }

  const lastActive = new Date(lastActiveVal);
  const nowDateStr = now.toDateString();
  const lastActiveDateStr = lastActive.toDateString();
  
  if (nowDateStr === lastActiveDateStr) return;
  
  const oneDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round(Math.abs((now.getTime() - lastActive.getTime()) / oneDay));
  
  let newStreak = Math.max(1, user.streak);
  if (diffDays === 1) {
    newStreak += 1;
  } else if (diffDays > 1) {
    newStreak = 1;
  }
  
  try {
    await db.execute(
      sql`UPDATE "user" SET streak = ${newStreak}, last_active = NOW() WHERE id = ${user.id}`
    );
    user.streak = newStreak;
  } catch (e) {
    console.error("Failed to update user streak:", e);
  }
}

// Dummy methods to satisfy compiler
export async function registerUser(email: string, pass: string, name: string): Promise<any> {
  throw new Error("Password registration is disabled. Please login with Google.");
}
export async function loginUser(email: string, pass: string): Promise<any> {
  throw new Error("Password login is disabled. Please login with Google.");
}
export async function logout() {
  // Client side signOut() cookie clearing
}
