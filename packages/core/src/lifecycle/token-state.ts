export type TokenFamilyStatus = "active" | "consumed" | "revoked" | "expired";

export interface TokenFamilyState {
  familyId: string;
  loginId: string;
  device: string;
  generation: number;
  status: TokenFamilyStatus;
  accessExpiresAt: number;
  refreshExpiresAt: number;
}

export type RefreshResult =
  | { ok: true; accessToken: string; refreshToken?: string; family: TokenFamilyState }
  | { ok: false; code: "TOKEN_EXPIRED" | "TOKEN_REPLAYED" | "TOKEN_REVOKED" | "TOKEN_INVALID" };

export type RevokeScope = "token" | "device" | "family" | "login";

export interface RevokeResult {
  ok: true;
  alreadyRevoked: boolean;
  scope: RevokeScope;
}
