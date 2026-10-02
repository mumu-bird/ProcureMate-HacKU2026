import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { db, now, audit } from "./db";
import type { Actor } from "./types";
export const actors: Actor[] = [
  { id: "manager", name: "Alex · 负责人", role: "manager" },
  { id: "buyer", name: "Jamie · 采购成员", role: "buyer" },
];
export function login(username: string, password: string) {
  const actor = actors.find((a) => a.id === username);
  if (!actor) return null;
  const expected =
    actor.role === "manager"
      ? process.env.MANAGER_PASSWORD || "welcome2026!"
      : process.env.BUYER_PASSWORD || "staff2026!";
  if (
    !timingSafeEqual(
      scryptSync(password, "procuremate-local", 32),
      scryptSync(expected, "procuremate-local", 32),
    )
  )
    return null;
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
    hash(token),
    JSON.stringify(actor),
    Date.now() + 12 * 3600_000,
  );
  audit(actor.id, "LOGIN", actor.id, { at: now() });
  return { token, actor };
}
function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function session(request: Request): Actor | null {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("pm_session="))
    ?.slice(11);
  if (!token) return null;
  const r = db
    .prepare("SELECT actor,expires FROM sessions WHERE token_hash=?")
    .get(hash(token)) as { actor: string; expires: number } | undefined;
  return r && r.expires > Date.now() ? JSON.parse(r.actor) : null;
}
export function logout(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("pm_session="))
    ?.slice(11);
  if (token)
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(hash(token));
}
