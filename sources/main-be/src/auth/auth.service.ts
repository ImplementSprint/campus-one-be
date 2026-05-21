import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { supabase, supabaseAdmin } from '../database/supabase';
import type { SignUpDto } from './dto/signup.dto';
import type { LoginDto } from './dto/login.dto';
import type { SignUpResponse, LoginResponse } from './interfaces/super-admin.interface';

@Injectable()
export class AuthService {
  async signUp(dto: SignUpDto): Promise<SignUpResponse> {
    const email = dto.email.toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from('portal_accounts')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    // Step 1 — Create Supabase Auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
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

    // Step 2 — Write to portal_accounts (this service's table)
    const { error: portalError } = await supabaseAdmin
      .from('portal_accounts')
      .insert({ id: authUserId, email });

    if (portalError) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      throw new InternalServerErrorException('Failed to create portal account.');
    }

    // Best-effort mirror — role is detected from portal_accounts, not super_admins
    try {
      await supabaseAdmin.from('super_admins').insert({ id: authUserId, email, role: 'super_admin' });
    } catch (_) {}

    return {
      message: 'Account created successfully.',
      user: { id: authUserId, email },
    };
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const email = dto.email.toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
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
    await supabase.auth.signOut();
    return { message: 'Signed out successfully.' };
  }

  private async detectRole(email: string): Promise<string | null> {
    const { data: portal } = await supabaseAdmin
      .from('portal_accounts')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (portal) return 'super_admin';

    const { data: admin } = await supabaseAdmin
      .from('admin_users')
      .select('role')
      .eq('email', email)
      .maybeSingle();
    if (admin) return admin.role ?? 'applicant_admin';

    const { data: student } = await supabaseAdmin
      .from('student_accounts')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (student) return 'student';

    const { data: professor } = await supabaseAdmin
      .from('professor_users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (professor) return 'professor';

    const { data: alumni } = await supabaseAdmin
      .from('alumni')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (alumni) return 'alumni';

    return null;
  }
}
