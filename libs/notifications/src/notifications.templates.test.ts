import { deepEqual, equal } from 'assert';
import { renderNotificationTemplate } from './notifications.templates';

const grade = renderNotificationTemplate('grade.submitted', {
  courseCode: 'IT101',
  className: 'BSIT 1A',
  finalGrade: '92',
});

equal(grade.title, 'Grade submitted');
equal(grade.body, 'Your IT101 grade for BSIT 1A has been submitted.');
deepEqual(grade.channels, ['in_app']);
deepEqual(grade.metadata, {
  action: 'grade.submitted',
  courseCode: 'IT101',
  className: 'BSIT 1A',
  finalGrade: '92',
});

const alumni = renderNotificationTemplate('alumni.record.status_updated', {
  documentType: 'DIPLOMA',
  status: 'Fulfilled',
});

equal(alumni.title, 'Alumni document status updated');
equal(alumni.body, 'Your DIPLOMA request is now Fulfilled.');
deepEqual(alumni.channels, ['in_app']);
deepEqual(alumni.metadata, {
  action: 'alumni.record.status_updated',
  documentType: 'DIPLOMA',
  status: 'Fulfilled',
});

const applicationSubmitted = renderNotificationTemplate('admissions.application.submitted', {
  reference: 'APP-1001',
  applicantName: 'Ava Santos',
});

equal(applicationSubmitted.title, 'Admissions application submitted');
equal(applicationSubmitted.body, 'Application APP-1001 for Ava Santos has been submitted.');
deepEqual(applicationSubmitted.channels, ['in_app']);
deepEqual(applicationSubmitted.metadata, {
  action: 'admissions.application.submitted',
  reference: 'APP-1001',
  applicantName: 'Ava Santos',
});

const fallback = renderNotificationTemplate('unknown.action', {});

equal(fallback.title, 'Campus One update');
equal(fallback.body, 'A new Campus One update is available.');
deepEqual(fallback.channels, ['in_app']);
deepEqual(fallback.metadata, { action: 'unknown.action' });
