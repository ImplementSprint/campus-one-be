import { deepEqual } from 'node:assert/strict';
import { mapInstitutionProfileToPublicSchool } from './public-school.service';

const publicSchool = mapInstitutionProfileToPublicSchool({
  id: 'institution-123',
  name: 'San Beda University',
  target_subdomain: 'san-beda',
  school_type: 'University',
  status: 'approved',
});

deepEqual(publicSchool, {
  schoolId: 'institution-123',
  schoolSlug: 'san-beda',
  displayName: 'San Beda University',
  schoolType: 'University',
  status: 'approved',
});

