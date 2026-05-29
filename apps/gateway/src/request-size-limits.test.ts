import { deepEqual } from 'node:assert/strict';
import { applyRequestSizeLimits, resolveRequestSizeLimits } from './request-size-limits';

const previousJsonLimit = process.env.REQUEST_JSON_LIMIT;
const previousFormLimit = process.env.REQUEST_FORM_LIMIT;

delete process.env.REQUEST_JSON_LIMIT;
delete process.env.REQUEST_FORM_LIMIT;

deepEqual(resolveRequestSizeLimits(), {
  json: '1mb',
  urlencoded: '256kb',
});

process.env.REQUEST_JSON_LIMIT = '2mb';
process.env.REQUEST_FORM_LIMIT = '512kb';

deepEqual(resolveRequestSizeLimits(), {
  json: '2mb',
  urlencoded: '512kb',
});

const calls: Array<{ parser: string; options: unknown }> = [];
applyRequestSizeLimits({
  useBodyParser(parser: string, options: unknown) {
    calls.push({ parser, options });
  },
});

deepEqual(calls, [
  { parser: 'json', options: { limit: '2mb' } },
  { parser: 'urlencoded', options: { limit: '512kb', extended: true } },
]);

if (previousJsonLimit === undefined) {
  delete process.env.REQUEST_JSON_LIMIT;
} else {
  process.env.REQUEST_JSON_LIMIT = previousJsonLimit;
}

if (previousFormLimit === undefined) {
  delete process.env.REQUEST_FORM_LIMIT;
} else {
  process.env.REQUEST_FORM_LIMIT = previousFormLimit;
}
