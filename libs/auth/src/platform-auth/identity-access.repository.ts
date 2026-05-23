import { Injectable } from '@nestjs/common';
import { IdentityAccessPrismaClient } from '@campus-one/database/prisma/identity-access-prisma.client';

export type TenantMembershipRecord = {
  institutionId: string;
  role: string;
  status: string;
};

export type IdentityAccessClient = {
  tenantUserMembership: {
    findFirst(args: {
      where: {
        userId: string;
        institutionId: string;
        status: 'active';
      };
      select: {
        institutionId: true;
        role: true;
        status: true;
      };
    }): Promise<TenantMembershipRecord | null>;
  };
  portalAccount: {
    findUnique(args: {
      where: { email: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  adminUser: {
    findUnique(args: {
      where: { email: string };
      select: { role: true };
    }): Promise<{ role: string | null } | null>;
  };
  studentAccount: {
    findUnique(args: {
      where: { email: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  professorUser: {
    findUnique(args: {
      where: { email: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  alumniAccount: {
    findUnique(args: {
      where: { email: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
};

@Injectable()
export class IdentityAccessRepository {
  constructor(private readonly client: IdentityAccessPrismaClient) {}

  static forClient(client: IdentityAccessClient): IdentityAccessRepository {
    return new IdentityAccessRepository(client as unknown as IdentityAccessPrismaClient);
  }

  findActiveTenantMembership(
    userId: string,
    institutionId: string,
  ): Promise<TenantMembershipRecord | null> {
    return this.client.tenantUserMembership.findFirst({
      where: {
        userId,
        institutionId,
        status: 'active',
      },
      select: {
        institutionId: true,
        role: true,
        status: true,
      },
    });
  }

  async detectRoleByEmail(email: string): Promise<string | null> {
    const normalizedEmail = email.trim().toLowerCase();

    const portal = await this.client.portalAccount.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (portal) return 'super_admin';

    const admin = await this.client.adminUser.findUnique({
      where: { email: normalizedEmail },
      select: { role: true },
    });
    if (admin) return admin.role ?? 'applicant_admin';

    const student = await this.client.studentAccount.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (student) return 'student';

    const professor = await this.client.professorUser.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (professor) return 'professor';

    const alumni = await this.client.alumniAccount.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (alumni) return 'alumni';

    return null;
  }
}
