# 교사 업무효율화 허브

선생님 업무를 돕는 작은 웹앱들을 모아 두는 허브예요. 서버 없이 `index.html`을 더블클릭하면 바로 열립니다.

## 폴더 구조

```
teacher-hub/
├─ index.html          ← 허브 첫 화면 (앱 카드 목록)
├─ apps.js             ← 앱 목록. 새 앱은 여기에 한 덩어리 추가
├─ assets/style.css    ← 모든 앱이 함께 쓰는 디자인 (색, 카드, 버튼)
└─ apps/
   └─ info-helper/     ← 첫 번째 앱: 정보 담당 도우미
      ├─ index.html
      └─ app.js
```

## 새 앱 추가하는 법 (3단계)

1. `apps/` 안에 새 폴더를 만들어요. 예: `apps/seat-maker/`
2. 그 안에 `index.html`을 만들고, `<head>`에 공통 디자인을 연결해요.
   ```html
   <link rel="stylesheet" href="../../assets/style.css" />
   ```
3. `apps.js`의 목록에 카드 정보를 추가해요.
   ```js
   {
     id: "seat-maker",
     name: "자리 배치 도우미",
     desc: "학급 자리를 무작위로 배치해요.",
     icon: "🪑",
     path: "apps/seat-maker/index.html",
     category: "학급 운영",
     status: "ready",
     color: "blue",
   },
   ```

AI에게 새 앱을 부탁할 때는 이렇게 말하면 편해요:
> "teacher-hub 구조에 맞춰 `apps/새앱이름/`에 앱을 만들고, `assets/style.css`의 클래스(card, btn, badge, input, table)를 써 줘. 데이터는 localStorage에 `teacherHub.새앱이름.v1` 키로 저장해 줘."

## 데이터 저장에 대해

- 이 허브는 **선생님 컴퓨터 한 대에서 혼자 쓰는 용도**로 만들었어요.
- 모든 데이터는 **지금 쓰는 브라우저**에만 저장돼요 (localStorage). 다른 컴퓨터나 다른 브라우저에서는 보이지 않아요.
- 브라우저 기록·사이트 데이터를 지우면 사라질 수 있으니, 정보 담당 도우미의 **백업·설정** 탭에서 가끔 백업 파일을 받아 두세요. 2주 넘게 백업하지 않으면 대시보드에 알림이 떠요.
- 비밀번호, 학생 개인정보(주민번호, 연락처 등)는 저장하지 마세요.

## 디자인

Google Stitch 프로젝트의 "Viridian Flow" 스타일(밝은 회청색 배경, 둥근 흰 카드, 딥 그린·일렉트릭 블루 포인트, 알약 모양 버튼)을 참고했어요. 색을 바꾸려면 `assets/style.css` 맨 위 `:root`의 색 값만 고치면 모든 앱에 한 번에 적용돼요.
