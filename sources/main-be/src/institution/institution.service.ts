import { Injectable, UnauthorizedException } from '@nestjs/common';
import { supabaseAdmin } from '../database/supabase';
import type { UpdateInstitutionDto } from './dto/update-institution.dto';

@Injectable()
export class InstitutionService {
  async getProfile(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('institution_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) {
      return {
        id: userId, name: '', representative: '', email: '',
        contact_number: '', school_type: '', target_subdomain: '',
        status: 'draft', setup_progress: 0,
      };
    }

    return data;
  }

  async updateProfile(userId: string, dto: UpdateInstitutionDto) {
    const { data, error } = await supabaseAdmin
      .from('institution_profiles')
      .upsert({ id: userId, ...dto }, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}
