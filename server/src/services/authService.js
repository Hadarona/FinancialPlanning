import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppError } from "../errors.js";

const POSTGRES_UNIQUE_VIOLATION = "23505";
const SESSION_TTL = "24h";

// A valid-format bcrypt hash used only when no user is found. It uses the
// configured work factor so `login` performs a comparable bcrypt operation
// for "unknown email" and "wrong password" (D-AUTH-B3).
export function createAuthService({
  userRepo,
  budgetService,
  config,
  withTransaction = async (work) => work(),
}) {
  const dummyHash = bcrypt.hashSync("no-account-with-this-email", config.bcryptRounds);

  async function register({ email, password }) {
    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    let user;
    try {
      user = await withTransaction(async (queryable) => {
        const createdUser = queryable
          ? await userRepo.createUser({ email, passwordHash }, queryable)
          : await userRepo.createUser({ email, passwordHash });
        if (queryable) {
          await budgetService.createDefaultBudget(createdUser.id, queryable);
        } else {
          await budgetService.createDefaultBudget(createdUser.id);
        }
        return createdUser;
      });
    } catch (err) {
      if (err?.code === POSTGRES_UNIQUE_VIOLATION) {
        throw new AppError("CONFLICT", "An account with that email already exists.");
      }
      throw err;
    }
    return { id: user.id, email: user.email };
  }

  async function login({ email, password }) {
    const user = await userRepo.findByEmail(email);
    const hashToCompare = user?.password_hash ?? dummyHash;
    const passwordMatches = await bcrypt.compare(password, hashToCompare);

    if (!user || !passwordMatches) {
      // Identical message/code whether the email exists or not (D-AUTH-B3).
      throw new AppError("UNAUTHENTICATED", "Incorrect email or password.");
    }
    return { id: user.id, email: user.email };
  }

  function signSession(user) {
    return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, {
      expiresIn: SESSION_TTL,
    });
  }

  function verifySession(token) {
    try {
      return jwt.verify(token, config.jwtSecret);
    } catch {
      return null;
    }
  }

  return { register, login, signSession, verifySession };
}
