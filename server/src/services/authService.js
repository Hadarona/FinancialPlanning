import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppError } from "../errors.js";

const POSTGRES_UNIQUE_VIOLATION = "23505";
const SESSION_TTL = "24h";

// A precomputed, valid-format bcrypt hash used only when no user is found,
// so `login` always performs one real bcrypt compare — equalizing response
// timing between "unknown email" and "wrong password" (D-AUTH-B3).
const DUMMY_HASH = bcrypt.hashSync("no-account-with-this-email", 10);

export function createAuthService({ userRepo, budgetService, config }) {
  async function register({ email, password }) {
    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    let user;
    try {
      user = await userRepo.createUser({ email, passwordHash });
    } catch (err) {
      if (err?.code === POSTGRES_UNIQUE_VIOLATION) {
        throw new AppError("CONFLICT", "An account with that email already exists.");
      }
      throw err;
    }
    // CR1-9: every account gets the default budget at registration. A
    // failure here propagates (registration must not half-succeed
    // silently); the defensive POST /budget path recovers the rare
    // mid-failure anomaly (plan risk 6).
    await budgetService.createDefaultBudget(user.id);
    return { id: user.id, email: user.email };
  }

  async function login({ email, password }) {
    const user = await userRepo.findByEmail(email);
    const hashToCompare = user?.password_hash ?? DUMMY_HASH;
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
