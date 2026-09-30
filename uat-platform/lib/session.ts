// Step 2 stand-in. The only valid token is the dev token, which behaves like a
// version A human session. Step 5 replaces this with the Session table.

export type ParticipantSession = { token: string; actorType: "human" | "synthetic" };

const DEV_TOKEN = "dev-a";

export async function getParticipantSession(token: string): Promise<ParticipantSession | null> {
  return token === DEV_TOKEN ? { token, actorType: "human" } : null;
}
