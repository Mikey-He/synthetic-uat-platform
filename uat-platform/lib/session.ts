// Stand-in until step 5. The only valid token is the dev token, a version A
// human session. Step 5 replaces this with the Session table.
//
// The variant is read in exactly one place: the create route's switch.

export type Variant = "A" | "B";

export type ParticipantSession = {
  token: string;
  actorType: "human" | "synthetic";
  variant: Variant;
};

const DEV_TOKEN = "dev-a";

export async function getParticipantSession(token: string): Promise<ParticipantSession | null> {
  return token === DEV_TOKEN ? { token, actorType: "human", variant: "A" } : null;
}
