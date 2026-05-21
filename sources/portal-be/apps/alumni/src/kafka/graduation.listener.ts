import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AlumniService } from '../alumni.service';

/**
 * GraduationListener — Kafka consumer for the `graduation.verified.v1` topic.
 *
 * Sprint 4 requirement: "Build the service that listens for graduation events
 * and sends a notification to their phone."
 *
 * When a graduation event fires, this listener:
 * 1. Logs the event to alumni_reg_activity_logs (action: alumni.graduation.verified.v1)
 * 2. (Future) Triggers a push notification to the alumni's device
 *
 * Kafka is connected via the KAFKA_BROKERS env var (comma-separated).
 * If Kafka is unavailable (e.g. local dev without a broker), the listener
 * degrades gracefully and logs a warning instead of crashing the service.
 */
@Injectable()
export class GraduationListener implements OnModuleInit {
  private readonly logger = new Logger(GraduationListener.name);

  constructor(private readonly alumniService: AlumniService) {}

  async onModuleInit(): Promise<void> {
    try {
      const { Kafka } = await import('kafkajs');

      const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');

      const kafka = new Kafka({
        clientId: 'alumni-service',
        brokers,
      });

      const consumer = kafka.consumer({ groupId: 'alumni-graduation-group' });

      await consumer.connect();
      await consumer.subscribe({
        topic: 'graduation.verified.v1',
        fromBeginning: false,
      });

      await consumer.run({
        eachMessage: async ({ message }) => {
          const raw = message.value?.toString();
          if (!raw) return;

          try {
            const payload = JSON.parse(raw) as {
              actor_uuid: string;
              tenant_id: string;
              full_name?: string;
              email?: string;
              program?: string;
              graduation_year?: number;
            };

            this.logger.log(
              `[Kafka] graduation.verified.v1 received — actor_uuid: ${payload.actor_uuid}`,
            );

            await this.alumniService.logGraduationEvent({
              actor_uuid: payload.actor_uuid,
              tenant_id: payload.tenant_id,
              full_name: payload.full_name ?? '',
              email: payload.email ?? '',
              program: payload.program ?? '',
              graduation_year: payload.graduation_year ?? new Date().getFullYear(),
            });
          } catch (parseErr) {
            this.logger.error(
              '[Kafka] Failed to process graduation.verified.v1 message',
              parseErr,
            );
          }
        },
      });

      this.logger.log(
        `[Kafka] GraduationListener connected — brokers: ${brokers.join(', ')}`,
      );
    } catch {
      this.logger.warn(
        '[Kafka] Broker unavailable — GraduationListener disabled. ' +
          'Set KAFKA_BROKERS env var to enable.',
      );
    }
  }
}
