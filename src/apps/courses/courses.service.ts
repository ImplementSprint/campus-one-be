import { Injectable } from '@nestjs/common';
import { supabase } from '../../libs/database/supabase';

@Injectable()
export class CoursesService {
  async getCourses(userId: string) {
    const db = supabase.schema('academics');
    const { data: enrollments, error } = await db
      .from('class_enrollments')
      .select(`id, class_assignments!inner(id, section, schedule, room, subjects!inner(code, name, units))`)
      .eq('student_id', userId)
      .eq('enrollment_status', 'enrolled');
    if (error) throw new Error(error.message);

    const courses = (enrollments || []).map((e: any) => ({
      offeringId: e.class_assignments.id,
      subjectCode: e.class_assignments.subjects.code,
      subjectName: e.class_assignments.subjects.name,
      units: e.class_assignments.subjects.units,
      section: e.class_assignments.section,
      schedule: e.class_assignments.schedule,
      room: e.class_assignments.room,
      instructor: null,
    }));
    const totalUnits = courses.reduce((sum, c) => sum + c.units, 0);
    return { courses, totalUnits };
  }
}
