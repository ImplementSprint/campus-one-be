import {
  Injectable,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { supabase, supabaseAdmin } from '@campus-one/database/supabase';
import type { TenantContext } from '../../../tenants/src/tenant-context';
import type { SignUpDto } from './dto/signup.dto';
import type { LoginDto } from './dto/login.dto';
import type { CurrentUserResponse, SignUpResponse, LoginResponse } from './interfaces/super-admin.interface';
import { IdentityAccessRepository } from './identity-access.repository';
import { getPermissionsForRole, normalizeRole } from './permissions';

export function getBearerToken(authorizationHeader?: string): string | null {
  const [scheme, token] = authorizationHeader?.trim().split(/\s+/) ?? [];
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

@Injectable()
export class AuthService {
  private authClient = supabase;
  private adminClient = supabaseAdmin;

  constructor(private readonly identityAccessRepository?: IdentityAccessRepository) {}

  static forClients(
    authClient: any,
    adminClient: any,
    identityAccessRepository?: Pick<IdentityAccessRepository, 'findActiveTenantMembership'>,
  ): AuthService {
    const service = new AuthService(identityAccessRepository as IdentityAccessRepository);
    service.authClient = authClient;
    service.adminClient = adminClient;
    return service;
  }

  async signUp(dto: SignUpDto): Promise<SignUpResponse> {
    const email = dto.email.toLowerCase();

    const { data: existing } = await this.adminClient
      .from('portal_accounts')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const { data: authData, error: authError } = await this.adminClient.auth.admin.createUser({
      email,
      password: dto.password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.toLowerCase().includes('already registered')) {
        throw new ConflictException('An account with this email already exists.');
      }
      throw new InternalServerErrorException(authError.message);
    }

    const authUserId = authData.user.id;

    const { error: portalError } = await this.adminClient
      .from('portal_accounts')
      .insert({ id: authUserId, email });

    if (portalError) {
      await this.adminClient.auth.admin.deleteUser(authUserId);
      throw new InternalServerErrorException('Failed to create portal account.');
    }

    try {
      await this.adminClient.from('super_admins').insert({ id: authUserId, email, role: 'super_admin' });
    } catch (_) {}

    return {
      message: 'Account created successfully.',
      user: { id: authUserId, email },
    };
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const email = dto.email.toLowerCase();

    const { data, error } = await this.authClient.auth.signInWithPassword({
      email,
      password: dto.password,
    });

    if (error || !data.user || !data.session) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const role = await this.detectRole(email);
    if (!role) {
      throw new UnauthorizedException('No account found with this email.');
    }

    return {
      message: 'Login successful.',
      user: { id: data.user.id, email, role },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      },
    };
  }

  async signOut(): Promise<{ message: string }> {
    await this.authClient.auth.signOut();
    return { message: 'Signed out successfully.' };
  }

  async getCurrentUser(authorizationHeader?: string, tenantContext?: TenantContext): Promise<CurrentUserResponse> {
    const token = getBearerToken(authorizationHeader);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const { data, error } = await this.adminClient.auth.getUser(token);
    const user = data?.user;
    const email = user?.email?.toLowerCase();

    if (error || !user?.id || !email) {
      throw new UnauthorizedException('Invalid or expired token.');
    }

    const detectedRole = await this.detectRole(email);
    let role = normalizeRole(detectedRole);
    if (!role) {
      throw new UnauthorizedException('No account found with this email.');
    }

    const activeInstitution = tenantContext?.resolvedInstitution;
    const tenantMembership = await this.resolveTenantMembership(user.id, role, activeInstitution);
    if (tenantMembership.role) {
      role = tenantMembership.role;
    }

    return {
      user: {
        id: user.id,
        email,
        role,
        permissions: getPermissionsForRole(role),
        activeInstitution,
        tenantMembership: {
          status: tenantMembership.status,
          reason: tenantMembership.reason,
        },
      },
    };
  }

  private async resolveTenantMembership(
    userId: string,
    role: NonNullable<ReturnType<typeof normalizeRole>>,
    activeInstitution?: CurrentUserResponse['user']['activeInstitution'],
  ): Promise<{
    status: CurrentUserResponse['user']['tenantMembership']['status'];
    reason?: string;
    role?: NonNullable<ReturnType<typeof normalizeRole>>;
  }> {
    if (!activeInstitution || role === 'super_admin') {
      return { status: 'not_applicable' };
    }

    let data;
    try {
      data = await this.identityAccessRepository?.findActiveTenantMembership(
        userId,
        activeInstitution.id,
      );
    } catch (_) {
      throw new ServiceUnavailableException('Unable to verify tenant membership.');
    }

    if (!this.identityAccessRepository) {
      throw new ServiceUnavailableException('Unable to verify tenant membership.');
    }

    if (!data) {
      throw new ForbiddenException('No active tenant membership for this school.');
    }

    const membershipRole = normalizeRole(data.role);
    if (!membershipRole) {
      throw new ForbiddenException('Tenant membership has an unsupported role.');
    }

    return { status: 'verified', role: membershipRole };
  }

  private async detectRole(email: string): Promise<string | null> {
    if (!this.identityAccessRepository) {
      throw new ServiceUnavailableException('Unable to detect account role.');
    }

    try {
      return await this.identityAccessRepository.detectRoleByEmail(email);
    } catch (_) {
      throw new ServiceUnavailableException('Unable to detect account role.');
    }
  }
}
