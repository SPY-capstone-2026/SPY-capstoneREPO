export type ApiStatusResponse = {
  status: string;
};

export type SignupRequest = {
  email: string;
  password: string;
};

export type SignupResponse = {
  status: 'success' | string;
  user_id: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: 'bearer' | string;
};

export type MeResponse = {
  user_id: string;
  email: string;
};

export type ApiChallenge = {
  challenge_id: number;
  user_id: string;
  category_name: string;
  challenge_date: string;
  challenge_type: string;
  challenge_text: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | string;
  xp_reward: number;
};

export type GenerateChallengesResponse = {
  status: 'success' | string;
  count: number;
  data: ApiChallenge[];
};