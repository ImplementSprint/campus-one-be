import { Injectable } from '@nestjs/common';
import { supabase } from '../../libs/database/supabase';

@Injectable()
export class ProfileService {
  async getProfile(userId: string) {
    const applicationDb = supabase.schema('applicant');
    const studentDb = supabase.schema('student');
    const alumniDb = supabase.schema('alumni');
    const facultyDb = supabase.schema('faculty');

    const [applicantRes, parentRes, academicRes, programRes, alumniRelativeRes, studentRes, alumniAccountRes, professorRes] = await Promise.all([
      applicationDb.from('applicant_profiles').select('*').eq('id', userId).maybeSingle(),
      applicationDb.from('parent_information').select('*').eq('applicant_id', userId).maybeSingle(),
      applicationDb.from('academic_background').select('*').eq('applicant_id', userId).order('completion_year', { ascending: false }),
      applicationDb.from('program_selections').select('*').eq('applicant_id', userId).maybeSingle(),
      applicationDb.from('alumni_relatives').select('*').eq('applicant_id', userId),
      studentDb.from('student_accounts').select('id, student_number, applicant_id, email, password_hash, is_active, created_at').or(`id.eq.${userId},applicant_id.eq.${userId}`).maybeSingle(),
      alumniDb.from('alumni').select('*').or(`id.eq.${userId}`).maybeSingle(),
      facultyDb.from('professor_users').select('*').or(`id.eq.${userId}`).maybeSingle(),
    ]);

    const accountType = professorRes.data
      ? 'professor'
      : studentRes.data
        ? 'student'
        : alumniAccountRes.data
          ? 'alumni'
          : applicantRes.data
            ? 'applicant'
            : null;

    return {
      accountType,
      applicant: applicantRes.data,
      parent: parentRes.data,
      academic: academicRes.data || [],
      program: programRes.data,
      alumni: alumniRelativeRes.data || [],
      studentNumber: studentRes.data?.student_number || null,
      student: studentRes.data || null,
      alumniAccount: alumniAccountRes.data || null,
      professor: professorRes.data || null,
    };
  }

  async updateProfile(userId: string, body: any) {
    const db = supabase.schema('applicant');
    const { first_name, last_name, middle_name, mobile_number, address } = body;
    const full_name = `${first_name} ${middle_name} ${last_name}`.replace(/\s+/g, ' ').trim();
    const { data, error } = await db
      .from('applicant_profiles')
      .update({ first_name, last_name, middle_name, mobile_number, address, full_name })
      .eq('id', userId).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
}
