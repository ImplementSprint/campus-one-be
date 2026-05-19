import { Injectable } from '@nestjs/common';
import { supabase } from '../../libs/database/supabase';

@Injectable()
export class SubjectsService {
  async getSubjects() {
    const db = supabase.schema('academics');
    const { data, error } = await db
      .from('subjects')
      .select('id, code, name, description, units, semester, school_year, is_active')
      .eq('is_active', true)
      .order('code');
    if (error) throw new Error(error.message);
    return (data || []).map((s: any) => ({
      id: s.id,
      subjectCode: s.code,
      subjectTitle: s.name,
      description: s.description,
      units: s.units,
      semester: s.semester,
      schoolYear: s.school_year,
    }));
  }

  async getUserInfo(userId: string) {
    const db = supabase.schema('academics');
    const { data: ap } = await db
      .from('applicant_profiles')
      .select('first_name, last_name')
      .eq('id', userId)
      .maybeSingle();
    const userName = ap ? `${ap.first_name} ${ap.last_name}` : '';
    return { userName };
  }
}
