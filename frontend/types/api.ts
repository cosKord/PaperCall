export type UserRole = "player" | "admin";
export type MarketStatus = "draft" | "open" | "locked" | "settled";
export type BetSide = "hit" | "miss";

export interface Me {
  id: number;
  email: string;
  role: UserRole;
  branch: string | null;
  balance: number;
  admin_verified: boolean;
}

export interface TimeResponse {
  now: string;
  pilot_admin_code_enabled: boolean;
}

export interface AuthResponse {
  ok: boolean;
  demo_code?: string;
}

export interface MarketSummary {
  id: number;
  subject: string;
  exam_type: string;
  lockout_at: string;
  status: MarketStatus;
}

export interface MyBet {
  side: BetSide;
  stake: number;
  payout?: number;
  net?: number;
}

export interface Topic {
  id: number;
  title: string;
  tier: "low" | "high";
  my_bet?: MyBet;
  outcome?: BetSide;
  pool?: Record<BetSide, number>;
}

export interface MarketDetail {
  id: number;
  subject: string;
  exam_type: string;
  starts_at: string;
  ends_at: string;
  lockout_at: string;
  status: MarketStatus;
  grant_pts: number;
  legacy: boolean;
  paper_available?: boolean;
  topics: Topic[];
}

export interface LeaderboardRow {
  email: string;
  score: number;
}

export interface AdminUser {
  id: number;
  email: string | null;
  branch: string | null;
  role: UserRole;
}

export interface SettlementPayout {
  user_id: number;
  amount: number;
  reason: string;
}

export interface SettlementPreview {
  digest: string;
  payout_total: number;
  payouts: Record<string, SettlementPayout>;
}

export interface SettledBet {
  market_id: number;
  subject: string;
  topic_id: number;
  topic: string;
  side: BetSide;
  stake: number;
  payout: number;
  net: number;
  outcome: BetSide;
  settled_at: string;
}

export interface ProfileResponse {
  user: Pick<Me, "id" | "email" | "branch" | "balance">;
  score: number;
  rank: number;
  settled_bets: SettledBet[];
}
