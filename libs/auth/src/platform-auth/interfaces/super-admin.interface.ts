export interface PortalAccount {
  id: string;
  email: string;
  created_at: string;
}

export interface SuperAdmin {
  id: string;
  email: string;
  role: 'super_admin';
  created_at: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface SignUpResponse {
  message: string;
  user: Pick<PortalAccount, 'id' | 'email'>;
}

export interface LoginResponse {
  message: string;
  user: { id: string; email: string; role: string };
  session: AuthSession;
}

export interface CurrentUserResponse {
  user: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
    activeInstitution?: {
      id: string;
      schoolSlug: string;
      status: string;
      name?: string;
    };
    tenantMembership: {
      status: 'not_applicable' | 'verified';
      reason?: string;
    };
  };
}
