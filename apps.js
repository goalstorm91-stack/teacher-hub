/* =========================================================
   앱 목록 (허브에 보이는 카드)
   새 앱을 만들면 아래 배열에 { ... } 한 덩어리만 추가하세요.

   id       : 영어 소문자, 폴더 이름과 같게 (예: "info-helper")
   name     : 카드에 보일 이름
   desc     : 한두 줄 설명
   icon     : 이모지 하나
   path     : 앱의 index.html 위치
   category : 분류 (필터 버튼으로 표시됨)
   status   : "ready"(사용 가능) | "beta"(시험 중) | "planned"(만들 예정)
   color    : "green" | "blue" | "navy" (카드 포인트 색)
   ========================================================= */
window.HUB_APPS = [
  {
    id: "info-helper",
    name: "정보 담당 도우미",
    desc: "스마트기기 대장·대여 기록, 연간 정보 업무 체크리스트, 에듀테크 사이트 목록을 한곳에서 관리해요.",
    icon: "💻",
    path: "apps/info-helper/index.html",
    category: "업무 관리",
    status: "ready",
    color: "green",
  },

  {
    id: "diary",
    name: "일기장",
    desc: "하루를 기록하는 일기장이에요. 일기는 인터넷이 아닌 내 컴퓨터에만 저장돼요. (쓰기 전에 '일기장 시작.bat'을 켜 주세요)",
    icon: "📔",
    path: "apps/diary/index.html",
    category: "나의 기록",
    status: "ready",
    color: "navy",
  },

  // ↓ 앞으로 만들 앱 예시 (필요 없으면 지우세요)
  {
    id: "seat-maker",
    name: "자리 배치 도우미",
    desc: "조건을 넣으면 학급 자리를 무작위로 배치해요.",
    icon: "🪑",
    path: "",
    category: "학급 운영",
    status: "planned",
    color: "blue",
  },
];
