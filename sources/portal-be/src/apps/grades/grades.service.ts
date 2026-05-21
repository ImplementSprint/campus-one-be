import { Injectable } from '@nestjs/common';
import { supabase } from '../../libs/database/supabase';

@Injectable()
export class GradesService {
  async getGrades(userId: string) {
    const applicationDb = supabase.schema('applicant');
    const studentDb = supabase.schema('student');

    const { data: ap } = await applicationDb.from('applicant_profiles')
      .select('first_name, last_name, program').eq('id', userId).maybeSingle();
    const studentName = ap ? `${ap.first_name} ${ap.last_name}` : '';
    const program = ap?.program ?? '';

    const { data: sa } = await studentDb.from('student_accounts')
      .select('id').eq('applicant_id', userId).maybeSingle();
    if (!sa) return { studentName, program, grades: [], totalUnits: 0, gwa: '0.00' };

    const { data: gradesData } = await studentDb.from('grades')
      .select('final_grade, remarks, subjects!inner(code, title, units)').eq('student_id', sa.id);

    const grades = (gradesData || []).map((r: any) => ({
      code: r.subjects?.code ?? '—', subject: r.subjects?.title ?? '—',
      units: r.subjects?.units ?? 0, grade: r.final_grade != null ? String(r.final_grade) : '—',
      remarks: r.remarks ?? '—',
    }));
    const totalUnits = grades.reduce((s, g) => s + g.units, 0);
    const nums = grades.map(g => parseFloat(g.grade)).filter(g => !isNaN(g));
    const gwa = nums.length > 0 ? (nums.reduce((s, g) => s + g, 0) / nums.length).toFixed(2) : '0.00';
    return { studentName, program, grades, totalUnits, gwa };
  }

  async getDeficiencies(userId: string) {
    const studentDb = supabase.schema('student');
    const { data: sa } = await studentDb.from('student_accounts')
      .select('id').eq('applicant_id', userId).maybeSingle();
    if (!sa) return [];
    const { data } = await studentDb.from('grades')
      .select('final_grade, remarks, subjects!inner(code, title)')
      .eq('student_id', sa.id).in('remarks', ['Failed', 'Incomplete']);
    return (data || []).map((d: any) => ({
      code: d.subjects?.code ?? '—', title: d.subjects?.title ?? '—',
      finalGrade: d.final_grade ?? null, remarks: d.remarks,
    }));
  }

  async getGraduation(userId: string) {
    const applicationDb = supabase.schema('applicant');
    const studentDb = supabase.schema('student');

    const { data: ap } = await applicationDb.from('applicant_profiles')
      .select('first_name, last_name, program').eq('id', userId).maybeSingle();
    const studentName = ap ? `${ap.first_name} ${ap.last_name}` : '';
    const program = ap?.program ?? '';

    const { data: sa } = await studentDb.from('student_accounts')
      .select('id, year_level').eq('applicant_id', userId).maybeSingle();
    if (!sa) return { studentName, program, yearLevel: null, grades: [] };

    const { data: gradesData } = await studentDb.from('grades')
      .select('final_grade, remarks, subjects!inner(code, title, units)')
      .eq('student_id', sa.id).not('final_grade', 'is', null);

    return {
      studentName, program, yearLevel: sa.year_level ?? null,
      grades: (gradesData || []).map((g: any) => ({
        code: g.subjects?.code ?? '—', title: g.subjects?.title ?? '—',
        units: g.subjects?.units ?? 0, finalGrade: g.final_grade, remarks: g.remarks,
      })),
    };
  }
}
