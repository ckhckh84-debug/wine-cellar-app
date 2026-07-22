# 내 와인 셀러

빌드 툴 없이 동작하는 순수 HTML/CSS/JS 앱입니다 (Supabase JS는 CDN으로 로드).

## 설정 방법

1. [supabase.com](https://supabase.com)에서 프로젝트 생성
2. SQL Editor에서 [schema.sql](schema.sql) 내용을 실행해 테이블 생성
3. Authentication → Providers에서 Email(매직 링크)이 활성화되어 있는지 확인 (기본값으로 켜져 있음)
4. Settings → API에서 `Project URL`과 `anon public` key를 복사해 [config.js](config.js)에 입력
5. 로컬에서 확인: `python -m http.server 5173` 실행 후 `http://localhost:5173` 접속

## 아이폰/아이패드에서 사용하기

정적 파일이므로 아무 정적 호스팅에나 올리면 됩니다 (GitHub Pages, Cloudflare Pages, Netlify 등).
배포 후 Safari에서 접속 → 공유 버튼 → "홈 화면에 추가"하면 앱처럼 아이콘으로 실행할 수 있습니다.

## 현재 구현 범위 (1단계)

- 이메일 매직 링크 로그인 (기기 간 데이터 동기화용)
- 와인 재고 추가/조회 (표 형태)
- 음용 적정시기 임박/경과 알림
- 와인별 시음노트 기록/조회

AI 소믈리에 대화 기능(추천, 페어링 제안 등)은 다음 단계에서 추가 예정입니다.
