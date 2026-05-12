# Driver Payment

필리핀에 파견된 한국 주재원이 개인 계약으로 고용한 운전기사의 급여를 관리하는 PWA 웹서비스입니다.

## 기능

- 👔 **고용인 모드** (한국어): 출근 관리, 급여 계산·지급, 드라이버 관리, 급여 설정
- 🚗 **드라이버 모드** (English): 급여 확인, 출근 기록 조회, 급여 명세서
- 📱 **PWA**: 모바일 홈화면에 설치 가능, 오프라인 지원
- ₱ **자동 급여 계산**: 평일/휴일 구분, OT 자동 산출 (8시간 초과분)

## 급여 체계

| 구분 | 일당 | OT 시급 |
|------|------|---------|
| 평일 | ₱695 | ₱86.88 |
| 휴일/일요일 | ₱1,000 | ₱150 |

- 기본 근무: **8시간/일**, **26일/월**
- OT: 8시간 초과분부터 적용

## 데모 계정

| 역할 | PIN |
|------|-----|
| 고용인 | 1234 |
| 드라이버 | 5678 |

## 로컬 실행

```bash
npm install
npm run dev
# http://localhost:3000 접속
```

## GCP App Engine 배포

```bash
# GCP CLI 설치 및 로그인
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 배포
gcloud app deploy

# 브라우저로 열기
gcloud app browse
```

## 프로젝트 구조

```
DriverPayment/
├── server.js              # Express 서버
├── app.yaml               # GCP App Engine 설정
├── config/
│   └── pay-settings.json  # 급여 설정 (수정 가능)
├── data/
│   ├── employers.json     # 고용인 데이터
│   ├── drivers.json       # 드라이버 데이터
│   ├── attendance.json    # 출근 기록
│   └── payments.json      # 급여 지급 내역
├── routes/
│   ├── auth.js            # 인증 API
│   ├── employers.js       # 고용인 API
│   ├── drivers.js         # 드라이버 API
│   ├── attendance.js      # 출근 기록 API
│   ├── payments.js        # 급여 계산/지급 API
│   └── settings.js        # 설정 API
├── utils/
│   └── dataStore.js       # JSON 파일 I/O 유틸
└── public/
    ├── index.html         # SPA 메인 페이지
    ├── manifest.json      # PWA 매니페스트
    ├── sw.js              # Service Worker
    ├── css/styles.css     # 디자인 시스템
    ├── js/
    │   ├── app.js         # 공통 유틸리티
    │   ├── auth.js        # 로그인 모듈
    │   ├── employer.js    # 고용인 화면
    │   └── driver.js      # 드라이버 화면
    └── icons/             # PWA 아이콘
```

## 급여 설정 변경

`config/pay-settings.json` 파일을 직접 수정하거나, 앱의 **설정** 탭에서 변경할 수 있습니다.

## 🚨 프로젝트 필수 규칙 (Project Rules)

이 프로젝트에 기여하거나 코드를 수정할 때 반드시 지켜야 하는 규칙입니다.

1. **데이터 무손실 및 마이그레이션 규칙 (Data Persistence & Migration Rule)**
   - **모든 사용자 데이터 보존**: 드라이버가 입력한 출퇴근 기록(`attendance.json`), 일정 내역(`schedules.json`), 급여 내역, 사용자 정보 등은 **어떤 코드 수정이나 배포 작업이 있더라도 절대 지워지거나 유실되어서는 안 됩니다.**
   - **스키마 변경 시 마이그레이션 필수**: 기존 데이터 구조(스키마)가 변경되는 경우, 이전 구조의 데이터가 에러 없이 새로운 구조로 호환되거나 자동 마이그레이션되는 로직이 반드시 포함되어야 합니다. 데이터 손실을 유발하는 파괴적(Destructive)인 덮어쓰기나 초기화는 엄격히 금지됩니다.

2. **영어 전용 작성 규칙 (English-Only Rule)**
   - **코드 주석 및 설명**: 소스 코드 내의 모든 주석(Comments), 커밋 메시지, 구현 설명은 모두 **영어(English)**로만 작성해야 합니다.
   - **UI 문자열**: 사용자에게 보여지는 프론트엔드의 모든 UI 텍스트(라벨, 버튼, 알림 메시지 등)는 **영어(English)**로 통일하여 작성해야 합니다. (이전에는 관리자용 화면이 한국어였으나, 현재는 모두 영어 UI로 전환되었으며 이 원칙을 유지합니다.)
