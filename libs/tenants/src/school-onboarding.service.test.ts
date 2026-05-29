import * as assert from 'node:assert/strict';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { SchoolOnboardingService } from './school-onboarding.service';

class FakeTenantRegistryRepository {
  duplicate: any | null = null;
  createdInput: any;

  async findInstitutionBySlug(slug: string) {
    if (slug === 'duplicate') {
      return this.duplicate ?? {
        id: 'institution-existing',
        name: 'Existing School',
        targetSubdomain: 'duplicate',
        status: 'approved',
      };
    }
    return null;
  }

  async createSchoolRegistration(input: any) {
    this.createdInput = input;
    return {
      institution: {
        id: input.institution.id,
        name: input.institution.name,
        targetSubdomain: input.institution.targetSubdomain,
        schoolType: input.institution.schoolType,
        status: 'pending_review',
      },
      onboarding: {
        currentStep: 'registration_submitted',
        progress: 10,
      },
      invitation: {
        id: 'invitation-123',
        email: input.invitation.email,
        status: 'pending',
        expiresAt: input.invitation.expiresAt,
      },
    };
  }
}

async function run() {
  const repository = new FakeTenantRegistryRepository();
  const service = new SchoolOnboardingService(repository as any) as any;
  const eventCalls: unknown[] = [];
  service.eventPublisher = {
    publish(input: unknown) {
      eventCalls.push(input);
      return Promise.resolve({ envelope: input, published: true });
    },
  };

  const response = await service.registerSchool({
    name: ' Demo University ',
    representative: ' Jane Registrar ',
    email: 'OWNER@DEMO.EDU',
    contactNumber: '+63 912 345 6789',
    schoolType: 'University',
    targetSubdomain: 'demo-school',
  });

  assert.equal(response.school.schoolSlug, 'demo-school');
  assert.equal(response.school.status, 'pending_review');
  assert.equal(response.onboarding.currentStep, 'registration_submitted');
  assert.equal(response.ownerInvitation.email, 'owner@demo.edu');
  assert.equal(repository.createdInput.institution.name, 'Demo University');
  assert.equal(repository.createdInput.institution.representative, 'Jane Registrar');
  assert.equal(repository.createdInput.institution.email, 'owner@demo.edu');
  assert.equal(repository.createdInput.invitation.tokenHash.length, 64);
  assert.equal(repository.createdInput.audit.eventType, 'platform.school.registered');
  assert.deepEqual(eventCalls, [
    {
      eventType: 'school.registration.submitted',
      tenantId: response.school.schoolId,
      actorId: 'owner@demo.edu',
      payload: {
        schoolId: response.school.schoolId,
        schoolSlug: 'demo-school',
        schoolName: 'Demo University',
        schoolType: 'University',
      },
    },
  ]);

  await assert.rejects(
    () => service.registerSchool({
      name: 'Demo',
      representative: 'Owner',
      email: 'owner@demo.edu',
      contactNumber: '+63 912 345 6789',
      schoolType: 'University',
      targetSubdomain: 'api',
    }),
    BadRequestException,
  );

  await assert.rejects(
    () => service.registerSchool({
      name: 'Duplicate',
      representative: 'Owner',
      email: 'owner@duplicate.edu',
      contactNumber: '+63 912 345 6789',
      schoolType: 'University',
      targetSubdomain: 'duplicate',
    }),
    ConflictException,
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
