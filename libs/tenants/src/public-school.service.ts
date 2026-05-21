import { Injectable, NotFoundException } from '@nestjs/common';
import { supabaseAdmin } from '@campus-one/database/supabase';

type InstitutionProfileRow = {
  id: string;
  name: string;
  target_subdomain: string;
  school_type?: string | null;
  status?: string | null;
};

export type PublicSchool = {
  schoolId: string;
  schoolSlug: string;
  displayName: string;
  schoolType?: string | null;
  status?: string | null;
};

export function mapInstitutionProfileToPublicSchool(row: InstitutionProfileRow): PublicSchool {
  return {
    schoolId: row.id,
    schoolSlug: row.target_subdomain,
    displayName: row.name,
    schoolType: row.school_type,
    status: row.status,
  };
}

@Injectable()
export class PublicSchoolService {
  async searchSchools(search?: string): Promise<PublicSchool[]> {
    let query = supabaseAdmin
      .from('institution_profiles')
      .select('id, name, target_subdomain, school_type, status')
      .eq('status', 'approved')
      .order('name', { ascending: true })
      .limit(25);

    if (search?.trim()) {
      const term = search.trim().replace(/[%_]/g, '');
      query = query.or(`name.ilike.%${term}%,target_subdomain.ilike.%${term}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data ?? []).map(mapInstitutionProfileToPublicSchool);
  }

  async getSchoolBySlug(slug: string): Promise<PublicSchool> {
    const { data, error } = await supabaseAdmin
      .from('institution_profiles')
      .select('id, name, target_subdomain, school_type, status')
      .eq('target_subdomain', slug)
      .eq('status', 'approved')
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('School not found');

    return mapInstitutionProfileToPublicSchool(data);
  }
}
