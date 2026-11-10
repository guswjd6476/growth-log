# 성장일지

공부·독서·습관·목표를 한곳에서 관리하는 자기계발 앱입니다. 웹앱(PWA)이라 아이폰·안드로이드 모두 홈 화면에 설치해 앱처럼 씁니다.

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm test         # 계산 로직 테스트
npm run build    # 배포용 빌드 (dist/)
```

## 배포 (Vercel)

1. GitHub에 올리고 Vercel에서 이 저장소를 가져오기 (Framework: Vite, 설정 그대로)
2. 책 검색을 카카오로 쓰려면 Vercel 환경 변수에 `KAKAO_REST_KEY` 추가
   - [Kakao Developers](https://developers.kakao.com) → 내 애플리케이션 → 앱 키 → **REST API 키**
   - 없으면 Google 도서 검색으로 찾고, 그것도 안 되면 직접 입력합니다.
3. (선택) 기기 간 동기화·앱 닫혀도 오는 알림 → 아래 Supabase 설정. 안 하면 기기 안에만 저장됩니다.

## 동기화·푸시 알림 (Supabase)

1. [supabase.com](https://supabase.com)에서 프로젝트 만들기
2. **SQL Editor**에 `supabase/migrations/0001_init.sql` 내용을 붙여 넣고 실행
3. **Authentication → Sign In / Providers → Email**에서 **Confirm email 끄기** (메일을 한 통도 보내지 않음. 앱은 아이디+비밀번호로 로그인)
4. 푸시용 키 만들기: `npx web-push generate-vapid-keys`
5. Vercel 환경 변수 (Project Settings → API에서 복사)
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`(위 Public Key)
   - 넣은 뒤 **재배포**해야 반영됩니다.
6. 알림 보내는 함수 배포 ([Supabase CLI](https://supabase.com/docs/guides/cli) 필요)
   ```bash
   npx supabase login
   npx supabase link --project-ref <프로젝트 ref>
   npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=https://<내 Vercel 주소> CRON_SECRET=<아무 긴 문자열>
   npx supabase functions deploy remind --no-verify-jwt
   ```
7. 1분마다 함수 부르기: **SQL Editor**에서 실행 (`<ref>`, `<CRON_SECRET>` 바꾸기)
   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;
   select cron.schedule('remind', '* * * * *', $$
     select net.http_post(
       url := 'https://<ref>.supabase.co/functions/v1/remind',
       headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb
     )
   $$);
   ```

로컬에서 쓰려면 `.env.example`을 `.env`로 복사해 값을 채웁니다.

## 휴대폰에 설치

- **아이폰**: Safari로 열기 → 공유 버튼 → **홈 화면에 추가**
- **안드로이드**: Chrome으로 열기 → ⋮ 메뉴 → **앱 설치**

## 구조

| 위치 | 내용 |
|---|---|
| `src/lib/types.ts` | 저장하는 데이터 모양 |
| `src/lib/store.ts` | 기기 안 저장(localStorage)과 화면 갱신 |
| `src/lib/logic.ts` | 연속 기록, 계획 대비 실제, 방치 알림, 레벨, 태그 연결, 연간 장부 계산 |
| `src/lib/actions.ts` | 할 일·습관·공부 기록을 바꾸는 함수 |
| `src/pages/*` | 화면 (오늘, 할 일, 집중, 독서, 습관, 목표, 기록, 통계, 설정) |
| `src/lib/sync.ts` | 로그인과 기기 간 동기화 (충돌 나면 `mergeData`로 합침) |
| `src/lib/push.ts` | 이 기기 푸시 구독 켜기·끄기 |
| `api/books.ts` | 카카오 책 검색 서버 함수 |
| `supabase/` | DB 테이블, 1분마다 알림 보내는 함수 |

## 아직 없는 것

- 바코드로 책 찍기
- 비밀번호 찾기 (메일을 안 쓰므로 잊으면 새 아이디로 가입해야 함. 기기 안 기록은 남아 있어 합쳐 올라감)
- 다른 기기에서 지운 항목이 오프라인으로 수정하던 기기에서 되살아날 수 있음 (드묾)
