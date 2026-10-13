import dbConnection from "../../../../db/db.config.js";

const toUser = (row) =>
  row && {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
  };

export const findUserByEmail = async (email) => {
  const [rows] = await dbConnection.execute(
    `SELECT id, name, email, password_hash, created_at
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email],
  );
  if (!rows[0]) return null;
  return { ...toUser(rows[0]), passwordHash: rows[0].password_hash };
};

export const findUserById = async (userId) => {
  const [rows] = await dbConnection.execute(
    `SELECT id, name, email, created_at
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId],
  );
  return toUser(rows[0]) || null;
};

export const createUser = async ({ name, email, passwordHash }) => {
  const [result] = await dbConnection.execute(
    `INSERT INTO users (name, email, password_hash)
     VALUES (?, ?, ?)`,
    [name, email, passwordHash],
  );
  return findUserById(result.insertId);
};
