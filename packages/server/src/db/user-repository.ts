// Database queries for creating and finding users (+ initializing user_stats)

import { pool } from "./pool.js";

export interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
}

export async function createUser(username: string, passwordHash: string): Promise<DbUser> {
  const result = await pool.query<DbUser>(
    `INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *`,
    [username, passwordHash],
  );
  await pool.query(`INSERT INTO user_stats (user_id) VALUES ($1)`, [result.rows[0].id]);
  return result.rows[0];
}

export async function findUserByUsername(username: string): Promise<DbUser | null> {
  const result = await pool.query<DbUser>(`SELECT * FROM users WHERE username = $1`, [username]);
  return result.rows[0] ?? null;
}
