export type UserRole = "player" | "admin";
export type MarketStatus = "draft" | "open" | "closed" | "settled";
export type BetSide = "hit" | "miss";
export type SettlementOutcome = BetSide | "void";

export interface Me {
  id: number;
  email: string;
  username?: string;
  role: UserRole;
  branch: string | null;
  balance: number;
  xp?: number;
  welcome_grant_available?: boolean;
  admin_verified: boolean;
}

export interface WelcomeGrantResponse {
  granted: boolean;
  amount: number;
  balance: number;
}

export interface TimeResponse {
  now: string;
  pilot_admin_code_enabled: boolean;
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
  outcome?: SettlementOutcome;
  pool?: Record<BetSide, number>;
  max_stake: number;
}

export interface MarketDetail {
  id: number;
  subject: string;
  exam_type: string;
  starts_at: string;
  ends_at: string | null;
  lockout_at: string;
  status: MarketStatus;
  grant_pts: number;
  legacy: boolean;
  paper_available?: boolean;
  topics: Topic[];
}

export interface LeaderboardRow {
  name: string;
  score: number;
  is_you: boolean;
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
  exam_type: string;
  topic_id: number;
  topic: string;
  side: BetSide;
  stake: number;
  payout: number;
  net: number;
  outcome: SettlementOutcome;
  settled_at: string;
}

export interface ProfileResponse {
  user: Pick<Me, "id" | "email" | "branch" | "balance"> & {
    username: string;
    full_name: string | null;
    academic_year: string | null;
    xp: number;
  };
  score: number;
  rank: number;
  prediction_count: number;
  subject_count: number;
  success_rate: number;
  active_bets: ActiveBet[];
  settled_bets: SettledBet[];
}

export interface ActiveBet {
  market_id: number;
  subject: string;
  exam_type: string;
  topic_id: number;
  topic: string;
  side: BetSide;
  stake: number;
}

export interface AdminUser {
  id: number;
  email: string;
  username: string | null;
  branch: string | null;
  active: boolean;
  created_at: string;
}
