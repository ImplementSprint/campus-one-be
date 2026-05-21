import { Injectable, NotFoundException } from '@nestjs/common';
import { supabaseAdmin } from './database/supabase';

const VALID_RESOURCES = ['classes','subjects','students','employees','accounts','fees','salary','attendance','notifications'] as const;
type ResourceName = typeof VALID_RESOURCES[number];

function isValidResource(r: string): r is ResourceName {
  return VALID_RESOURCES.includes(r as ResourceName);
}

@Injectable()
export class InstitutionDataService {

  async list(institutionId: string, resource: string, search?: string) {
    if (!isValidResource(resource)) throw new NotFoundException(`Unknown resource: ${resource}`);

    let query = supabaseAdmin
      .from('institution_resources')
      .select('id, data, created_at, updated_at')
      .eq('institution_id', institutionId)
      .eq('resource_type', resource)
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data ?? []).map((r: any) => ({ id: r.id, ...r.data }));

    if (!search?.trim()) return rows;

    const term = search.trim().toLowerCase();
    return rows.filter((row: any) =>
      Object.values(row).some((v) => String(v).toLowerCase().includes(term))
    );
  }

  async create(institutionId: string, resource: string, payload: Record<string, string>) {
    if (!isValidResource(resource)) throw new NotFoundException(`Unknown resource: ${resource}`);

    const id = payload.id ?? `${resource}-${Date.now()}`;
    const { id: _id, ...data } = payload;

    const { data: row, error } = await supabaseAdmin
      .from('institution_resources')
      .insert({ id, institution_id: institutionId, resource_type: resource, data: { ...data } })
      .select('id, data')
      .single();

    if (error) throw new Error(error.message);
    return { id: row.id, ...row.data };
  }

  async update(institutionId: string, resource: string, id: string, payload: Record<string, string>) {
    if (!isValidResource(resource)) throw new NotFoundException(`Unknown resource: ${resource}`);

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('institution_resources')
      .select('data')
      .eq('id', id)
      .eq('institution_id', institutionId)
      .eq('resource_type', resource)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!existing) throw new NotFoundException('Record not found');

    const merged = { ...existing.data, ...payload };
    const { data: row, error } = await supabaseAdmin
      .from('institution_resources')
      .update({ data: merged, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, data')
      .single();

    if (error) throw new Error(error.message);
    return { id: row.id, ...row.data };
  }

  async remove(institutionId: string, resource: string, id: string) {
    if (!isValidResource(resource)) throw new NotFoundException(`Unknown resource: ${resource}`);

    const { error } = await supabaseAdmin
      .from('institution_resources')
      .delete()
      .eq('id', id)
      .eq('institution_id', institutionId)
      .eq('resource_type', resource);

    if (error) throw new Error(error.message);
    return { id, deleted: true };
  }

  async markAllNotificationsRead(institutionId: string) {
    const { data, error } = await supabaseAdmin
      .from('institution_resources')
      .select('id, data')
      .eq('institution_id', institutionId)
      .eq('resource_type', 'notifications');

    if (error) throw new Error(error.message);

    const unread = (data ?? []).filter((r: any) => r.data?.read !== true);
    if (unread.length === 0) return { updated: 0 };

    await Promise.all(
      unread.map((r: any) =>
        supabaseAdmin
          .from('institution_resources')
          .update({ data: { ...r.data, read: true } })
          .eq('id', r.id)
      )
    );

    return { updated: unread.length };
  }

  async dashboard(institutionId: string) {
    const { data, error } = await supabaseAdmin
      .from('institution_resources')
      .select('resource_type, data')
      .eq('institution_id', institutionId);

    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const byType = (type: string) => rows.filter((r: any) => r.resource_type === type);

    const fees = byType('fees');
    const salary = byType('salary');
    const revenue = fees.reduce((sum: number, r: any) => {
      const v = parseFloat(String(r.data?.amount ?? '0').replace(/[^0-9.]/g, ''));
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
    const expenses = salary.reduce((sum: number, r: any) => {
      const v = parseFloat(String(r.data?.baseSalary ?? '0').replace(/[^0-9.]/g, ''));
      return sum + (isNaN(v) ? 0 : v);
    }, 0);

    return {
      totalStudents: byType('students').length,
      totalEmployees: byType('employees').length,
      revenue,
      profit: revenue - expenses,
    };
  }

  async getProfile(institutionId: string) {
    const { data, error } = await supabaseAdmin
      .from('institution_profiles')
      .select('*')
      .eq('id', institutionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { id: institutionId, name: '', representative: '', email: '', contact_number: '', school_type: '', target_subdomain: '', status: 'draft', setup_progress: 0 };
  }

  async updateProfile(institutionId: string, payload: Record<string, unknown>) {
    const { data, error } = await supabaseAdmin
      .from('institution_profiles')
      .upsert({ id: institutionId, ...payload }, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
}
