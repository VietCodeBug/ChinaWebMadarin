import { cookies } from 'next/headers';
import { query } from './db';
import crypto from 'crypto';

export interface User {
  id: number;
  email: string;
  display_name: string | null;
  exp: number;
  max_combo: number;
  streak: number;
  last_active: Date;
}

// Hash password with SHA-256 and salt
function hashPassword(password: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

// Generate secure random salt
function generateSalt(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = cookies();
  const userIdStr = cookieStore.get('user_id')?.value;
  
  if (!userIdStr) return null;
  
  const userId = parseInt(userIdStr, 10);
  if (isNaN(userId)) return null;
  
  try {
    const res = await query(
      "SELECT id, email, display_name, exp, max_combo, streak, last_active FROM users WHERE id = $1",
      [userId]
    );
    if (res.rows.length > 0) {
      const user = res.rows[0];
      // Update streak and last_active if it is a new day
      await updateStreakIfNeeded(user);
      return user;
    }
  } catch (e) {
    console.error("Auth getCurrentUser error:", e);
  }
  return null;
}

async function updateStreakIfNeeded(user: User) {
  const now = new Date();
  const lastActive = new Date(user.last_active);
  
  // Strip time parts to compare calendar dates
  const nowDateStr = now.toDateString();
  const lastActiveDateStr = lastActive.toDateString();
  
  if (nowDateStr === lastActiveDateStr) {
    // Already active today, nothing to do
    return;
  }
  
  // Calculate difference in days
  const oneDay = 24 * 60 * 60 * 1000; // milliseconds in one day
  const diffDays = Math.round(Math.abs((now.getTime() - lastActive.getTime()) / oneDay));
  
  let newStreak = user.streak;
  if (diffDays === 1) {
    // Yesterday was the last active, increment streak
    newStreak += 1;
  } else if (diffDays > 1) {
    // More than 1 day missed, reset streak to 1
    newStreak = 1;
  }
  
  try {
    await query(
      "UPDATE users SET streak = $1, last_active = NOW() WHERE id = $2",
      [newStreak, user.id]
    );
    user.streak = newStreak;
    user.last_active = now;
  } catch (e) {
    console.error("Failed to update user streak:", e);
  }
}

export async function registerUser(email: string, password: string, displayName: string): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();
  
  if (!normalizedEmail || !password || !displayName.trim()) {
    throw new Error("Tất cả các trường thông tin đều bắt buộc");
  }

  // Generate salt and hash
  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);
  
  try {
    const res = await query(
      `INSERT INTO users (email, password_hash, salt, display_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, email, display_name, exp, max_combo, streak, last_active`,
      [normalizedEmail, passwordHash, salt, displayName.trim()]
    );
    
    const user = res.rows[0];
    
    // Set cookie session
    cookies().set('user_id', user.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    });
    
    return user;
  } catch (e: any) {
    if (e.code === '23505') { // Unique constraint violation (Postgres)
      throw new Error("Email này đã được đăng ký tài khoản");
    }
    console.error("Registration error:", e);
    throw new Error("Đăng ký tài khoản thất bại. Vui lòng thử lại.");
  }
}

export async function loginUser(email: string, password: string): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();
  
  if (!normalizedEmail || !password) {
    throw new Error("Email và mật khẩu không được trống");
  }
  
  try {
    // Fetch user and salt
    const res = await query(
      "SELECT id, email, password_hash, salt, display_name, exp, max_combo, streak, last_active FROM users WHERE email = $1",
      [normalizedEmail]
    );
    
    if (res.rows.length === 0) {
      throw new Error("Tài khoản hoặc mật khẩu không chính xác");
    }
    
    const user = res.rows[0];
    const computedHash = hashPassword(password, user.salt);
    
    if (computedHash !== user.password_hash) {
      throw new Error("Tài khoản hoặc mật khẩu không chính xác");
    }
    
    // Check and update streak
    await updateStreakIfNeeded(user);
    
    // Set cookie
    cookies().set('user_id', user.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    });
    
    // Remove password hash and salt from return
    return {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      exp: user.exp,
      max_combo: user.max_combo,
      streak: user.streak,
      last_active: user.last_active
    };
  } catch (e: any) {
    console.error("Login logic error:", e);
    throw new Error(e.message || "Đăng nhập thất bại");
  }
}

export async function logout() {
  cookies().delete('user_id');
}
