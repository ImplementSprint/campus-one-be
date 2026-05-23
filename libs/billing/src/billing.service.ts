import { Injectable } from '@nestjs/common';
import { supabase } from '@campus-one/database/supabase';

type PaymentStatus = 'unpaid' | 'partial' | 'paid';

@Injectable()
export class BillingService {
  private readonly db = supabase.schema('billing');

  async getStudentBalance(studentId: string) {
    const [assessmentsResult, paymentsResult] = await Promise.all([
      this.db
        .from('student_fee_assessments')
        .select('id, amount, status, due_date, description')
        .eq('student_id', studentId),
      this.db
        .from('student_payments')
        .select('id, amount, status, paid_at, reference_number')
        .eq('student_id', studentId)
        .order('paid_at', { ascending: false }),
    ]);

    if (assessmentsResult.error) throw assessmentsResult.error;
    if (paymentsResult.error) throw paymentsResult.error;

    const assessments = assessmentsResult.data ?? [];
    const payments = paymentsResult.data ?? [];
    const totalAssessed = assessments.reduce((sum: number, item: any) => sum + Number(item.amount ?? 0), 0);
    const totalPaid = payments
      .filter((item: any) => item.status === 'posted' || item.status === 'paid')
      .reduce((sum: number, item: any) => sum + Number(item.amount ?? 0), 0);
    const balanceDue = Math.max(totalAssessed - totalPaid, 0);

    return {
      studentId,
      currency: 'PHP',
      totalAssessed,
      totalPaid,
      balanceDue,
      paymentStatus: this.getPaymentStatus(totalAssessed, totalPaid),
      paymentMode: 'manual',
      assessments: assessments.map((item: any) => ({
        id: item.id,
        amount: Number(item.amount ?? 0),
        status: item.status,
        dueDate: item.due_date,
        description: item.description,
      })),
      recentPayments: payments.slice(0, 5).map((item: any) => ({
        id: item.id,
        amount: Number(item.amount ?? 0),
        status: item.status,
        paidAt: item.paid_at,
        referenceNumber: item.reference_number,
      })),
    };
  }

  async recordManualPayment(
    studentId: string,
    payload: { amount: number; referenceNumber: string; paidAt?: string; notes?: string },
  ) {
    const { data, error } = await this.db
      .from('student_payments')
      .insert({
        student_id: studentId,
        amount: Number(payload.amount),
        reference_number: payload.referenceNumber,
        paid_at: payload.paidAt ?? new Date().toISOString(),
        notes: payload.notes ?? null,
        status: 'pending_reconciliation',
        payment_mode: 'manual',
      })
      .select('id, student_id, amount, status, paid_at, reference_number')
      .single();

    if (error) throw error;

    return {
      id: data.id,
      studentId: data.student_id,
      amount: Number(data.amount ?? 0),
      status: data.status,
      paidAt: data.paid_at,
      referenceNumber: data.reference_number,
    };
  }

  async getReceipt(studentId: string, paymentId: string) {
    const { data, error } = await this.db
      .from('student_payments')
      .select('id, student_id, amount, status, paid_at, reference_number, receipt_number')
      .eq('student_id', studentId)
      .eq('id', paymentId)
      .single();

    if (error) throw error;

    return {
      id: data.id,
      studentId: data.student_id,
      amount: Number(data.amount ?? 0),
      status: data.status,
      paidAt: data.paid_at,
      referenceNumber: data.reference_number,
      receiptNumber: data.receipt_number ?? data.reference_number,
      currency: 'PHP',
    };
  }

  async getReconciliationQueue() {
    const { data, error } = await this.db
      .from('student_payments')
      .select('id, student_id, amount, status, paid_at, reference_number')
      .in('status', ['pending_reconciliation', 'pending', 'paid'])
      .order('paid_at', { ascending: false });

    if (error) throw error;

    return {
      mode: 'manual',
      payments: (data ?? []).map((item: any) => ({
        id: item.id,
        studentId: item.student_id,
        amount: Number(item.amount ?? 0),
        status: item.status,
        paidAt: item.paid_at,
        referenceNumber: item.reference_number,
      })),
    };
  }

  private getPaymentStatus(totalAssessed: number, totalPaid: number): PaymentStatus {
    if (totalAssessed <= 0 || totalPaid <= 0) return 'unpaid';
    if (totalPaid >= totalAssessed) return 'paid';
    return 'partial';
  }
}
