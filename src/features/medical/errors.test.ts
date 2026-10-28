import { ApiError } from '../../shared/auth/authApi';
import { medicalErrorMessage } from './errors';

it.each([
  ['The latest re-examination must record RECOVERED before closure when an injury or treatment plan exists.', 'lần tái khám gần nhất phải ghi nhận Đã hồi phục'],
  ['All treatment tasks must be completed before case closure.', 'Groom cần hoàn tất'],
  ['All restrictions linked to the case must be lifted before closure.', 'Hoàn tất công việc chăm sóc không tự gỡ hạn chế'],
  ['All incidents linked to the case must be resolved before closure.', 'xử lý xong các sự cố'],
])('explains the actual closure refusal without treating it as success: %s', (message, expected) => {
  expect(medicalErrorMessage(new ApiError(409, 'BUSINESS_RULE_VIOLATION', message), 'fallback')).toContain(expected);
});

it('keeps unknown failures and forbidden clinical access explicit', () => {
  expect(medicalErrorMessage(new Error('New server failure'), 'fallback')).toBe('New server failure');
  expect(medicalErrorMessage(new ApiError(403, 'FORBIDDEN', 'Outside scope'), 'fallback')).toBe('Không có quyền truy cập: Outside scope');
});
