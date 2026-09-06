import {
  BREED_SIZE_LABEL,
  type Facility,
  type Pet,
  type Requirement,
} from '@/data/types';
import { API_URL } from '@/lib/config';

/**
 * 동반 출입증의 핵심 — 시설이 게시한 조건과 우리 아이의 정보를 한 줄씩 대조한다.
 *
 * 문 앞에서 거부당하는 이유는 대부분 "직원이 확신이 없어서"다. 판별 결과만 보여주면
 * "그건 앱 얘기죠"가 되지만, 시설이 스스로 게시한 조건과 아이 정보를 나란히 놓으면
 * 직원은 재량으로 판단할 필요 없이 대조만 하면 된다.
 */

export type RuleStatus =
  /** 조건을 확실히 충족 — 앱이 가진 정보로 증명 가능 */
  | 'MET'
  /** 조건을 충족하지 못함 */
  | 'UNMET'
  /** 방문자가 준비해야 하는 항목 — 앱이 판단할 수 없다 (리드줄·케이지 등) */
  | 'BRING';

export interface RuleRow {
  /** 대조 항목 이름 */
  label: string;
  /** 시설이 게시한 조건 */
  rule: string;
  /** 우리 아이의 해당 값 */
  mine: string;
  status: RuleStatus;
}

/**
 * 방문자가 지참해야 하는 요구사항 — 앱이 충족 여부를 알 수 없다.
 * Partial이 아니라 Record로 둔다. Requirement에 종류가 늘었을 때 여기 누락되면
 * 판별 조건에는 뜨는데 출입증 지참 항목에는 안 뜨는 조용한 구멍이 생긴다.
 * 지참 대상이 아닌 것(체중·종 제한 등)은 null로 명시해 "빠뜨린 것"과 구분한다.
 */
const BRING_ITEMS: Record<Requirement, { label: string; rule: string; mine: string } | null> = {
  LEASH: { label: '리드줄', rule: '착용 필수', mine: '지참' },
  CAGE: { label: '케이지', rule: '이동장 필수', mine: '지참' },
  MUZZLE: { label: '입마개', rule: '착용 필수', mine: '착용' },
  MANNER_BELT: { label: '매너벨트', rule: '착용 필수', mine: '착용' },
  STROLLER: { label: '유모차', rule: '카트 이용 필수', mine: '준비' },
  // 아래 셋은 위에서 이미 전용 행을 만든다(접종 여부·체급·이용 구역까지 대조하므로
  // 여기서 또 넣으면 같은 항목이 두 줄로 뜬다). 빠뜨린 게 아니라는 뜻으로 null을 명시한다.
  VACCINATION: null,
  SMALL_ONLY: null,
  OUTDOOR_ONLY: null,
};

/** 시설 조건 × 반려동물 정보 대조표 */
export function buildRuleRows(pet: Pet, facility: Facility): RuleRow[] {
  const rows: RuleRow[] = [];

  // 체중 제한
  if (facility.maxWeight !== null) {
    rows.push({
      label: '체중',
      rule: `${facility.maxWeight}kg 이하`,
      mine: `${pet.weight}kg`,
      status: pet.weight <= facility.maxWeight ? 'MET' : 'UNMET',
    });
  }

  // 체급 제한
  if (facility.requirements.includes('SMALL_ONLY')) {
    rows.push({
      label: '체급',
      rule: '소형견만',
      mine: `${BREED_SIZE_LABEL[pet.breedSize]}견`,
      status: pet.breedSize === 'SMALL' ? 'MET' : 'UNMET',
    });
  }

  // 예방접종
  if (facility.requirements.includes('VACCINATION')) {
    rows.push({
      label: '예방접종',
      rule: '증명서 지참',
      mine: pet.vaccinated ? `${pet.vaccinationDate ?? '완료'} 접종` : '미접종',
      status: pet.vaccinated ? 'MET' : 'UNMET',
    });
  }

  // 이용 구역 제한
  if (facility.requirements.includes('OUTDOOR_ONLY')) {
    rows.push({
      label: '이용 구역',
      rule: '야외 공간만',
      mine: '야외 이용',
      status: 'MET',
    });
  }

  // 방문자 지참 항목
  facility.requirements.forEach((r) => {
    const item = BRING_ITEMS[r];
    if (item) rows.push({ ...item, status: 'BRING' });
  });

  return rows;
}

/**
 * QR에 담을 검증 주소.
 *
 * 코드는 **서버가 발급한다**(`POST /ai/check` 응답의 `verdicts[].verifyCode`).
 * 예전에는 `checkId * 31 + petId * 17`을 20비트로 접어 앱이 직접 만들었는데, 그건
 * 충돌하고 역산도 된다. 이 페이지는 인증 없이 열리면서 반려동물 이름·체중·접종여부까지
 * 보여주므로 **코드 하나가 곧 열람 권한**이다 — 예측 가능한 값이면 남의 출입증을 열 수 있다.
 * 그래서 서버가 CSPRNG로 `FP-` + 12자(36^12)를 발급하고 앱은 받은 값을 그대로 쓴다.
 *
 * 코드가 없으면(로컬 판별한 목 시설 등) QR을 그리지 않는다 — 열리지 않는 주소를 QR로 만들면
 * 직원이 스캔했을 때 404를 보게 된다.
 */
export function passVerifyUrl(verifyCode: string): string {
  return `${API_URL}/verify/${verifyCode}`;
}

/** 발급 시각 문구 — "2026. 7. 22. 14:32 발급" */
export function formatIssuedAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )} 발급`;
}
