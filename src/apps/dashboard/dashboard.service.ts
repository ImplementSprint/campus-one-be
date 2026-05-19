import { Injectable } from '@nestjs/common';
import { supabase } from '../../libs/database/supabase';

@Injectable()
export class DashboardService {
  async getDashboard(userId: string) {
    const applicationDb = supabase.schema('application');
    const studentDb = supabase.schema('student');

    const { data: ap } = await applicationDb
      .from('applicant_profiles').select('first_name, last_name').eq('id', userId).maybeSingle();
    const name = ap ? `${ap.first_name} ${ap.last_name}` : '';

    const { data: studentAccount } = await studentDb
      .from('student_accounts').select('id, student_number').eq('applicant_id', userId).maybeSingle();

    let enrolledCourses = 0, enrolledUnits = 0;
    if (studentAccount) {
      const { data: enrollments } = await studentDb
        .from('class_enrollments')
        .select('class_assignment_id, class_assignments!inner(subject_id, subjects!inner(units))')
        .eq('student_id', studentAccount.id)
        .eq('enrollment_status', 'enrolled');
      if (enrollments?.length) {
        enrolledCourses = enrollments.length;
        enrolledUnits = enrollments.reduce((sum: number, e: any) => sum + (e.class_assignments?.subjects?.units ?? 0), 0);
      }
    }
    return { name, enrolledCourses, enrolledUnits, cartSubjects: 0, cartUnits: 0 };
  }
}
