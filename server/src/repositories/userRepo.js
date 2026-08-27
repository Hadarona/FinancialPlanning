/**
 * User repository. Factory-created from a pg Pool so it can be scoped to a
 * per-server (real or isolated test) connection pool instead of a shared
 * module-level singleton.
 */
export function createUserRepo(pool) {
  return {
    async createUser({ email, passwordHash }, queryable = pool) {
      const result = await queryable.query(
        `INSERT INTO users (email, password_hash)
         VALUES ($1, $2)
         RETURNING id, email, created_at`,
        [email, passwordHash],
      );
      return result.rows[0];
    },

    async findByEmail(email) {
      const result = await pool.query(
        `SELECT id, email, password_hash, created_at FROM users WHERE email = $1`,
        [email],
      );
      return result.rows[0] ?? null;
    },

    async findById(id) {
      const result = await pool.query(
        `SELECT id, email, created_at FROM users WHERE id = $1`,
        [id],
      );
      return result.rows[0] ?? null;
    },
  };
}
