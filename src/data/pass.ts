/**
 * 꼬리패스 — 사용자 구독(출시 전). 혜택 목록은 한 곳에서 관리한다(소개 화면·잠금 안내가 같은 말을 쓰게).
 * 기획: freepets-docs docs/19-수익화-기획.md A절. 가격은 아직 정하지 않았다 — 화면에 쓰지 않는다.
 */
export type PassFeatureId = 'compensation' | 'tripPlan' | 'diaryCloud' | 'recapPlus' | 'vetNearby' | 'familyShare' | 'seasonCosmetics';

export interface PassFeature {
  id: PassFeatureId;
  icon: string;
  title: string;
  body: string;
  /** 무료 사용자가 지금 받는 것 */
  free: string;
  pass: string;
  /** 소개 화면 맨 위에 크게 */
  hero?: boolean;
}

export const PASS_FEATURES: PassFeature[] = [
  {
    id: 'compensation',
    icon: 'shield-checkmark',
    title: '헛걸음 보상',
    body: '"동반 가능 확정" 매장에서 출입을 거부당하면 포인트로 돌려 드려요. 판별을 저희가 책임져요.',
    free: '—',
    pass: '월 2회',
    hero: true,
  },
  {
    id: 'tripPlan',
    icon: 'sparkles',
    title: 'AI 여행 플래너',
    body: '지역·날짜만 고르면 우리 아이가 모두 들어갈 수 있는 곳으로만 하루 코스를 짜 드려요. 비 오는 날은 실내 위주로.',
    free: '월 1회',
    pass: '무제한',
    hero: true,
  },
  {
    id: 'diaryCloud',
    icon: 'cloud-upload',
    title: '추억 클라우드',
    body: '캘린더 사진·기록을 안전하게 보관해요. 폰을 바꿔도 그대로, 가족과 함께 봐요.',
    free: '기기에만',
    pass: '클라우드 백업',
  },
  {
    id: 'recapPlus',
    icon: 'images',
    title: '계절 리캡 고화질',
    body: '계절마다 열리는 리캡을 고화질 카드로 저장하고, 포토북·여권 실물 인쇄를 할인받아요.',
    free: '보기 · 공유',
    pass: '+ 저장 · 인쇄 할인',
  },
  {
    id: 'vetNearby',
    icon: 'medkit',
    title: '여행지 동물병원',
    body: '여행지 근처 동물병원을 거리순으로, 응급 표시와 함께 바로 찾아요.',
    free: '지도 앱으로 검색',
    pass: '앱 안에서 바로',
  },
  {
    id: 'familyShare',
    icon: 'people',
    title: '가족 공유',
    body: '함께 키우는 가족과 일정·건강 기록·추억을 같이 관리해요.',
    free: '—',
    pass: '최대 4명',
  },
  {
    id: 'seasonCosmetics',
    icon: 'color-palette',
    title: '계절 한정 꾸미기',
    body: '꼬리 친구에게 계절마다 새 소품을 입혀요. 기본 소품은 지금처럼 퀘스트로 얻어요.',
    free: '퀘스트 소품',
    pass: '+ 계절 세트',
  },
];

/** 무료로 계속 쓰는 것 — 소개 화면이 "이건 돈 안 받아요"를 먼저 말한다 */
export const ALWAYS_FREE = ['출입 판별 · 코스 판별', '거부 제보 · 리뷰', '여행 안심 키트', '퀘스트 · 도장 · 리캡 보기'];
