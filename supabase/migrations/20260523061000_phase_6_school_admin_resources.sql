ALTER TABLE public.institution_resources
  DROP CONSTRAINT IF EXISTS institution_resources_type_check;

ALTER TABLE public.institution_resources
  ADD CONSTRAINT institution_resources_type_check CHECK (
    resource_type IN (
      'classes',
      'subjects',
      'students',
      'employees',
      'accounts',
      'fees',
      'salary',
      'attendance',
      'notifications',
      'school-users',
      'user-invitations',
      'delivery-queue',
      'departments',
      'programs',
      'curricula',
      'sections',
      'rooms',
      'class-assignments',
      'terms'
    )
  );
