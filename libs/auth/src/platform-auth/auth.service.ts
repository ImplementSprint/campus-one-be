import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { SignUpDto } from './dto/signup.dto';
import type { LoginDto } from './dto/login.dto';
import type { SignUpResponse, LoginResponse } from './interfaces/super-admin.interface';

export type StoredAccount = {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  activeInstitutionId?: string | null;
};

export type CurrentUser = {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  activeInstitutionId: string | null;
};

export interface AuthRepository {
  findAccountByEmail(email: string): Promise<StoredAccount | null>;
  createPortalAccount(account: StoredAccount): Promise<void>;
}

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export class PostgresAuthRepository implements AuthRepository {
  private pool: any;

  async findAccountByEmail(email: string): Promise<StoredAccount | null> {
    const result = await this.query(
      `
        select
          pa.id,
          pa.email,
          pa.password_hash,
          coalesce(soa.role, sa.role, 'super_admin') as role,
          soa.institution_id as "activeInstitutionId"
        from portal_accounts pa
        left join super_admins sa on lower(sa.email) = lower(pa.email)
        left join school_owner_accounts soa on lower(soa.email) = lower(pa.email)
        where lower(pa.email) = lower($1)
        limit 1
      `,
      [email],
    );
    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      activeInstitutionId: row.activeInstitutionId ?? null,
    };
  }

  async createPortalAccount(account: StoredAccount): Promise<void> {
    await this.query(
      `
        insert into portal_accounts (id, email, password_hash)
        values ($1, $2, $3)
      `,
      [account.id, account.email, account.passwordHash],
    );

    if (account.role === 'school_owner' && account.activeInstitutionId) {
      await this.query(
        `
          insert into school_owner_accounts (id, institution_id, email, role)
          values ($1, $2, $3, $4)
          on conflict (id) do nothing
        `,
        [account.id, account.activeInstitutionId, account.email, account.role],
      ).catch(() => undefined);
      return;
    }

    await this.query(
      `
        insert into super_admins (id, email, role)
        values ($1, $2, $3)
        on conflict (id) do nothing
      `,
      [account.id, account.email, account.role],
    ).catch(() => undefined);
  }

  private async query(text: string, values: unknown[]) {
    if (!this.pool) {
      const databaseUrl = process.env.DATABASE_URL || process.env.IDENTITY_ACCESS_DATABASE_URL;
      if (!databaseUrl) {
        throw new InternalServerErrorException('DATABASE_URL or IDENTITY_ACCESS_DATABASE_URL must be configured.');
      }

      const { Pool } = require('pg');
      this.pool = new Pool({ connectionString: databaseUrl });
    }

    return this.pool.query(text, values);
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getAuthSecret(): string {
  const secret = process.env.CAMPUS_ONE_AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new InternalServerErrorException('CAMPUS_ONE_AUTH_SECRET must be configured.');
  }
  return secret;
}

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function hashPassword(password: string, salt = randomBytes(16).toString('base64url')): string {
  const hash = scryptSync(password, salt, 64).toString('base64url');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [scheme, salt, hash] = storedHash.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;

  const expected = Buffer.from(hash, 'base64url');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function permissionsForRole(role: string): string[] {
  if (role === 'super_admin') {
    return [
      'platform.schools.review',
      'platform.schools.approve',
      'platform.schools.suspend',
      'audit.read',
    ];
  }

  if (role === 'school_owner') {
    return [
      'tenant.read',
      'tenant.manage',
      'school.settings.manage',
      'school.users.manage',
    ];
  }

  return [];
}

function signUserToken(user: CurrentUser): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      activeInstitutionId: user.activeInstitutionId,
      iat: Math.floor(Date.now() / 1000),
    }),
  );
  const body = `${header}.${payload}`;
  const signature = createHmac('sha256', getAuthSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyUserToken(token: string): CurrentUser {
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) {
    throw new UnauthorizedException('Invalid access token.');
  }

  const body = `${header}.${payload}`;
  const expected = createHmac('sha256', getAuthSecret()).update(body).digest('base64url');
  const actualSignature = Buffer.from(signature);
  const expectedSignature = Buffer.from(expected);
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    throw new UnauthorizedException('Invalid access token.');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new UnauthorizedException('Invalid access token.');
  }
  if (!parsed.sub || !parsed.email || !parsed.role) {
    throw new UnauthorizedException('Invalid access token.');
  }

  return {
    id: parsed.sub,
    email: parsed.email,
    role: parsed.role,
    permissions: Array.isArray(parsed.permissions) ? parsed.permissions : permissionsForRole(parsed.role),
    activeInstitutionId: parsed.activeInstitutionId ?? null,
  };
}

@Injectable()
export class AuthService {
  constructor(@Inject(AUTH_REPOSITORY) private readonly repository: AuthRepository) {}

  async signUp(dto: SignUpDto): Promise<SignUpResponse> {
    const email = normalizeEmail(dto.email);
    const existing = await this.repository.findAccountByEmail(email);

    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const account: StoredAccount = {
      id: randomUUID(),
      email,
      passwordHash: hashPassword(dto.password),
      role: 'super_admin',
    };

    try {
      await this.repository.createPortalAccount(account);
    } catch (error: any) {
      if (String(error?.message ?? '').toLowerCase().includes('duplicate')) {
        throw new ConflictException('An account with this email already exists.');
      }
      throw error;
    }

    return {
      message: 'Account created successfully.',
      user: { id: account.id, email },
    };
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const email = normalizeEmail(dto.email);
    const account = await this.repository.findAccountByEmail(email);

    if (!account || !verifyPassword(dto.password, account.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const user: CurrentUser = {
      id: account.id,
      email: account.email,
      role: account.role,
      permissions: permissionsForRole(account.role),
      activeInstitutionId: account.activeInstitutionId ?? null,
    };

    return {
      message: 'Login successful.',
      user,
      session: {
        access_token: signUserToken(user),
        refresh_token: '',
        expires_in: 3600,
      },
    };
  }

  async signOut(): Promise<{ message: string }> {
    return { message: 'Signed out successfully.' };
  }

  async verifyAccessToken(token: string): Promise<CurrentUser> {
    return verifyUserToken(token);
  }
}
