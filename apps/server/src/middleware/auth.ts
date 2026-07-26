import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { config } from "../config.js";

const jwksUrl = new URL("/auth/v1/.well-known/jwks.json", config.supabaseUrl);
const jwks = createRemoteJWKSet(jwksUrl);

export async function verifySupabaseToken(
  token: string,
): Promise<JWTPayload & { sub: string }> {
  if (config.supabaseJwtSecret) {
    const secret = new TextEncoder().encode(config.supabaseJwtSecret);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    if (!payload.sub) {
      throw new Error("Invalid token subject");
    }
    return payload as JWTPayload & { sub: string };
  }

  const { payload } = await jwtVerify(token, jwks, {
    algorithms: ["ES256", "RS256", "HS256"],
  });
  if (!payload.sub) {
    throw new Error("Invalid token subject");
  }
  return payload as JWTPayload & { sub: string };
}
