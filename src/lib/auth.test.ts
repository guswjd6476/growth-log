import { describe, expect, it } from 'vitest';
import { emailOf } from '../../api/auth';

describe('소셜 로그인 계정 이메일', () => {
    it('구글은 확인된 메일만 그대로, 아니면 고유 id', () => {
        expect(emailOf('google', { sub: '1', email: 'A@gmail.com', email_verified: true })).toBe('a@gmail.com');
        expect(emailOf('google', { sub: '1', email: 'a@gmail.com', email_verified: false })).toBe('google_1@users.growth-log.example');
    });
    it('카카오·네이버는 메일이 있어도 고유 id 로만 (남의 메일로 가로채기 방지)', () => {
        expect(emailOf('kakao', { id: 42, kakao_account: { email: 'victim@x.com' } })).toBe('kakao_42@users.growth-log.example');
        expect(emailOf('naver', { response: { id: 'abc', email: 'victim@x.com' } })).toBe('naver_abc@users.growth-log.example');
        expect(emailOf('naver', {})).toBeNull();
    });
});
