import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('student/:studentId/balance')
  async getStudentBalance(@Param('studentId') studentId: string) {
    if (!studentId?.trim()) {
      throw new BadRequestException('student id is required');
    }

    return this.billingService.getStudentBalance(studentId);
  }

  @Post('student/:studentId/manual-payments')
  async recordManualPayment(
    @Param('studentId') studentId: string,
    @Body() body: { amount: number; referenceNumber: string; paidAt?: string; notes?: string },
  ) {
    if (!studentId?.trim()) {
      throw new BadRequestException('student id is required');
    }
    if (!body?.referenceNumber?.trim() || !(Number(body.amount) > 0)) {
      throw new BadRequestException('Manual payment requires amount greater than zero and referenceNumber');
    }

    return this.billingService.recordManualPayment(studentId, body);
  }

  @Get('student/:studentId/receipts/:paymentId')
  async getReceipt(
    @Param('studentId') studentId: string,
    @Param('paymentId') paymentId: string,
  ) {
    if (!studentId?.trim()) {
      throw new BadRequestException('student id is required');
    }
    if (!paymentId?.trim()) {
      throw new BadRequestException('payment id is required');
    }

    return this.billingService.getReceipt(studentId, paymentId);
  }

  @Get('admin/reconciliation')
  async getReconciliationQueue() {
    return this.billingService.getReconciliationQueue();
  }
}
