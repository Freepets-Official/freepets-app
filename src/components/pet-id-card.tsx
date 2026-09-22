import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { PetAvatar } from '@/components/pet-avatar';
import { Text } from '@/components/text';
import { TierPaw } from '@/components/tier-paw';
import { Radius, Spacing } from '@/constants/theme';
import { footprintsOf } from '@/data/footprints';
import { usePetStats } from '@/hooks/use-pet-stats';
import { levelProgress, tierName } from '@/data/level';
import {
  BREED_SIZE_LABEL,
  CATEGORY_LABEL,
  PET_GENDER_LABEL,
  PET_KIND_LABEL,
  petAgeYears,
  satisfactionMood,
  type Pet,
} from '@/data/types';
import { useAppStore } from '@/store/app-store';

/**
 * 반려동물 여권 — 홈의 아이 카드.
 *
 * **펼쳐 놓은 여권**의 모양이다. 왼쪽 면에는 사진과 이 아이의 정보가, 오른쪽 면에는
 * 최애 장소·보호자·발급일이 들어간다. 뒤에 두 장이 어긋나게 깔려 책이 두께를 가진
 * 것처럼 보인다.
 *
 * 이름을 「주민등록증」에서 「여권」으로 바꾼 이유는 탭 이름과 어긋나서다 — 도장첩도
 * 출입증도 전부 여권이라 부르는데 홈의 이 카드만 신분증이었다. 한 물건을 두 이름으로
 * 부르면 사용자는 다른 기능으로 읽는다.
 *
 * 색은 **양쪽 테마에서 같다.** 여권이라는 물건 자체가 종이 질감이라, 다크 모드에서
 * 회색으로 뒤집으면 카드가 아니라 패널로 보인다. 대신 모든 색을 여기서 직접 정해
 * 어느 배경에 놓여도 대비가 유지되게 한다.
 */
const CARD = {
  paper: '#F6F0E2',
  paperDeep: '#EADFC6',
  ink: '#2E2823',
  sub: '#8A7B62',
  line: 'rgba(120,101,66,0.32)',
  strip: '#3A332A',
  stripInk: '#F4ECDA',
  gold: '#B08A3C',
};

/** 배경 보안 무늬 — 발자국·뼈다귀·물결. 진짜 신분증의 기요셰(guilloche) 자리다 */
function SecurityPattern() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <G opacity={0.07} fill={CARD.ink}>
        <Circle cx="42" cy="34" r="4.6" />
        <Circle cx="56" cy="24" r="3.4" />
        <Circle cx="286" cy="150" r="5.2" />
        <Ellipse cx="300" cy="62" rx="9" ry="6" transform="rotate(24 300 62)" />
        <Ellipse cx="120" cy="196" rx="7" ry="4.6" transform="rotate(-16 120 196)" />
        <Path d="M196 24c6-4 12 2 18-1" stroke={CARD.ink} strokeWidth="2" fill="none" />
        <Path d="M24 120c10-8 20 6 30-2" stroke={CARD.ink} strokeWidth="2" fill="none" />
      </G>
    </Svg>
  );
}

/**
 * 여권 면의 한 줄. 라벨을 값 위에 두는 실제 여권 서식 그대로다.
 *
 * 면이 좁아 두 칸을 나란히 놓을 수 없다 — 폭이 좁은 기기에서 「생년월일」 같은 라벨이
 * 줄바꿈되면 줄 높이가 제각각이 되어 두 면의 높이가 어긋난다.
 */
function Field({ label, en, value, strong }: { label: string; en: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel} numberOfLines={1}>
        {label} <Text style={styles.fieldLabelEn}>{en}</Text>
      </Text>
      <Text style={[styles.fieldValue, strong && styles.fieldValueStrong]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function PetIdCard({ pet }: { pet: Pet }) {
  const router = useRouter();
  const { topPlacesForPet, gamification, account, settings, checks, stamps, satisfactions } = useAppStore();
  const top = topPlacesForPet(pet.petId, 3);
  const progress = gamification ? levelProgress(gamification) : null;
  /**
   * 이 아이와 함께한 기록. **레벨이 아니다** — XP·레벨은 계정 하나뿐이고(보호자 칸),
   * 아이 쪽은 "얼마나 같이 다녔는지"를 상한 없이 세어 보여준다.
   */
  const localFootprints = footprintsOf(pet.petId, { checks, stamps, satisfactions });
  // 서버 합계가 오면 그걸 쓴다 — 기기 기록은 기기를 바꾸면 줄어든다(2026-09-20 배포)
  const serverStats = usePetStats(pet.petId);
  const footprintTotal = serverStats?.total ?? localFootprints.total;
  const medal = ['🥇', '🥈', '🥉'];
  /** 발급번호 — 아이 등록 순서(petId)를 6자리로. 서식의 빈칸을 그럴듯한 값으로 채운다 */
  const serial = String(pet.petId).padStart(6, '0');
  const vaccinationText = pet.vaccinated
    ? pet.vaccinationDate
      ? `완료 · ${pet.vaccinationDate.replace(/-/g, '.')}`
      : '완료'
    : '미등록';
  /** 나이는 저장하지 않고 생년월일에서 계산한다 — 저장하면 해가 바뀌어도 그대로 남는다 */
  const age = petAgeYears(pet.birthDate);
  const birthText = pet.birthDate ? pet.birthDate.replace(/-/g, '.') : '미등록';
  const ageText = age === null ? '미등록' : `${age}살`;
  /** 발급일은 서버가 준 등록 시각. 앱이 만들 수 있는 값이 아니라 없으면 비워 둔다 */
  const issuedText = pet.createdAt ? pet.createdAt.slice(0, 10).replace(/-/g, '.') : '—';

  return (
    <View style={styles.card}>
      <SecurityPattern />
      {/*
        책 두께. 카드 **안쪽** 가장자리에 종이 층을 그린다.
        홈 카드를 감싸는 쪽이 `overflow: hidden`이라 바깥으로 깔면 잘려서 안 보인다.
        펼친 책을 위에서 보면 두께가 드러나는 곳이 바로 양옆(배지) 가장자리다.
      */}
      <View style={[styles.edge, styles.edgeLeft]} pointerEvents="none" />
      <View style={[styles.edge, styles.edgeLeftInner]} pointerEvents="none" />
      <View style={[styles.edge, styles.edgeRight]} pointerEvents="none" />
      <View style={[styles.edge, styles.edgeRightInner]} pointerEvents="none" />

        <View style={styles.head}>
          <View style={styles.headTexts}>
            <Text style={styles.title}>반려동물 여권</Text>
            <Text style={styles.titleEn}>PET PASSPORT</Text>
          </View>
          {/* 홀로그램 씰 자리 — 레벨 배지(발바닥). 레벨이 오르면 색·선명도가 바뀐다 */}
          {gamification && <TierPaw gamification={gamification} size={48} />}
        </View>

        <View style={styles.spread}>
          {/* ── 왼쪽 면 — 사진과 이 아이 ───────────────────────────── */}
          <View style={styles.page}>
            <View style={styles.photoRing}>
              <View style={styles.photoInner}>
                <PetAvatar pet={pet} size={64} />
              </View>
            </View>
            <Text style={styles.kind}>{PET_KIND_LABEL[pet.kind]}</Text>

            <Field label="이름" en="NAME" value={pet.name} strong />
            {/* 면이 좁아 한 줄에 둘씩 못 놓는다. 성별과 나이는 짧아 한 칸에 같이 적는다 */}
            <Field
              label="성별 · 나이"
              en="SEX / AGE"
              value={`${pet.gender ? PET_GENDER_LABEL[pet.gender] : '미등록'} · ${ageText}`}
            />
            <Field label="품종" en="BREED" value={pet.species || '미등록'} />
            <Field label="몸무게" en="WEIGHT" value={`${pet.weight}kg · ${BREED_SIZE_LABEL[pet.breedSize]}`} />
            <Field label="생년월일" en="DATE OF BIRTH" value={birthText} />
            <Field label="예방접종" en="VACCINATION" value={vaccinationText} />

            <View style={styles.footprints}>
              <Ionicons name="paw" size={11} color={CARD.gold} />
              <Text style={styles.footprintsText}>
                함께한 발자국 <Text style={styles.footprintsCount}>{footprintTotal.toLocaleString()}</Text>개
              </Text>
            </View>
          </View>

          {/* 가운데 접힘선 — 실 꿰맨 자국까지 넣어야 두 면으로 읽힌다 */}
          <View style={styles.spine}>
            <View style={styles.spineLine} />
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.stitch} />
            ))}
          </View>

          {/* ── 오른쪽 면 — 다닌 곳과 보호자 ───────────────────────── */}
          <View style={styles.page}>
            <Text style={styles.favTitle}>
              최애 장소 <Text style={styles.fieldLabelEn}>TOP 3</Text>
            </Text>
            {top.length === 0 ? (
              <Text style={styles.favEmpty}>
                아직 기록이 없어요.{'\n'}다녀온 곳에서 만족도를 남기면 채워져요.
              </Text>
            ) : (
              top.map((item, i) => (
                <View
                  key={item.facility.facilityId}
                  onTouchEnd={() => router.push({ pathname: '/facility/[id]', params: { id: String(item.facility.facilityId) } })}
                  style={styles.favRow}>
                  <Text style={styles.medal}>{medal[i]}</Text>
                  <Text style={styles.favName} numberOfLines={1}>
                    {item.facility.name}
                  </Text>
                  <Text style={styles.favScore}>{item.score.toFixed(1)}</Text>
                </View>
              ))
            )}

            {/*
              레벨·XP·티어는 **계정(집사) 값**이다. 아이가 여럿이어도 같은 숫자라, 왼쪽
              면(아이 정보)에 두면 이 아이의 레벨로 읽힌다. 여권의 발급기관 자리처럼
              오른쪽 면으로 분리한다.
            */}
            {gamification && progress && (
              <View style={styles.guardian}>
                <Text style={styles.fieldLabel} numberOfLines={1}>
                  보호자 <Text style={styles.fieldLabelEn}>GUARDIAN</Text>
                </Text>
                <Text style={styles.guardianName} numberOfLines={1}>
                  {account.nickname}
                </Text>
                <View style={styles.guardianLevel}>
                  <Text style={styles.guardianLv}>Lv.{progress.level}</Text>
                  <View style={styles.xpTrack}>
                    <View style={[styles.xpFill, { width: `${Math.max(5, progress.ratio * 100)}%` }]} />
                  </View>
                </View>
                <Text style={styles.guardianTier} numberOfLines={1}>
                  {tierName(gamification, settings.pawAnimal || gamification.tierAnimal).replace(/^.* 발바닥 /, '발바닥 ')}
                </Text>
              </View>
            )}

          <View style={styles.strip}>
            <Text style={styles.stripLabel}>발급일 ISSUED</Text>
            <Text style={styles.stripValue}>{issuedText}</Text>
            <Text style={styles.stripValue}>No. {serial}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * 책 두께 — 카드 안쪽 양옆에 종이 층을 그린다.
   *
   * 바깥으로 장을 깔지 않는 이유는 홈의 카드 래퍼가 `overflow: hidden`이라서다.
   * 밖으로 나가면 잘려서 아무것도 안 보인다. 펼친 책을 위에서 보면 두께가 드러나는 곳은
   * 어차피 양옆 배지 가장자리다.
   */
  edge: { position: 'absolute', top: 10, bottom: 10, width: 4, backgroundColor: CARD.paperDeep },
  edgeLeft: { left: 0, opacity: 0.9 },
  edgeLeftInner: { left: 4, width: 2.5, opacity: 0.55, top: 15, bottom: 15 },
  edgeRight: { right: 0, opacity: 0.9 },
  edgeRightInner: { right: 4, width: 2.5, opacity: 0.55, top: 15, bottom: 15 },

  card: { backgroundColor: CARD.paper, borderRadius: Radius.xl, overflow: 'hidden' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headTexts: { flex: 1, gap: 1 },
  title: { fontSize: 19, fontWeight: '900', color: CARD.ink, letterSpacing: -0.6 },
  titleEn: { fontSize: 10, fontWeight: '700', color: CARD.sub, letterSpacing: 1.2 },

  /** 두 면. 높이를 맞추려고 `alignItems: stretch`(기본)를 그대로 쓴다 */
  spread: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg },
  page: { flex: 1, gap: 7, paddingHorizontal: Spacing.xs },

  /** 가운데 접힘선 + 실 꿰맨 자국 */
  spine: {
    width: 15,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 6,
  },
  spineLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: CARD.line,
  },
  stitch: { width: 1.5, height: 7, borderRadius: 1, backgroundColor: CARD.sub, opacity: 0.55 },

  /** 사진 — 여권 사진처럼 테를 두른다 */
  photoRing: {
    alignSelf: 'center',
    padding: 3,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: CARD.line,
    backgroundColor: '#FFFFFF',
  },
  photoInner: { borderRadius: Radius.sm, overflow: 'hidden' },
  kind: {
    alignSelf: 'center',
    fontSize: 10.5,
    fontWeight: '800',
    color: CARD.sub,
    marginBottom: 2,
  },

  field: { gap: 1 },
  fieldLabel: { fontSize: 9, fontWeight: '800', color: CARD.sub, letterSpacing: 0.2 },
  fieldLabelEn: { fontSize: 8, fontWeight: '700', color: CARD.sub, opacity: 0.75 },
  fieldValue: { fontSize: 12.5, fontWeight: '800', color: CARD.ink },
  fieldValueStrong: { fontSize: 16, fontWeight: '900', color: CARD.ink, letterSpacing: -0.3 },

  footprints: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: CARD.line,
  },
  footprintsText: { flexShrink: 1, fontSize: 10, fontWeight: '700', color: CARD.sub },
  footprintsCount: { fontSize: 12, fontWeight: '900', color: CARD.ink },

  favTitle: { fontSize: 10, fontWeight: '800', color: CARD.sub, letterSpacing: 0.2 },
  favEmpty: { fontSize: 10.5, lineHeight: 15, color: CARD.sub },
  favRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  medal: { fontSize: 11 },
  favName: { flexShrink: 1, fontSize: 11.5, fontWeight: '800', color: CARD.ink },
  favScore: {
    marginLeft: 'auto',
    fontSize: 11,
    fontWeight: '800',
    color: CARD.ink,
    fontVariant: ['tabular-nums'],
  },

  guardian: {
    gap: 2,
    marginTop: 'auto',
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: CARD.line,
  },
  guardianName: { fontSize: 13, fontWeight: '900', color: CARD.ink },
  guardianLevel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  guardianLv: { fontSize: 11, fontWeight: '900', color: CARD.ink, fontVariant: ['tabular-nums'] },
  xpTrack: {
    flex: 1,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: CARD.line,
    overflow: 'hidden',
  },
  xpFill: { height: '100%', borderRadius: Radius.full, backgroundColor: CARD.gold },
  guardianTier: { fontSize: 9.5, fontWeight: '700', color: CARD.gold },

  /** 발급 정보 — 여권 아래쪽 기계판독 영역 자리 */
  strip: {
    gap: 1,
    marginTop: 7,
    borderRadius: Radius.sm,
    backgroundColor: CARD.strip,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  stripLabel: { fontSize: 8, fontWeight: '800', color: CARD.stripInk, opacity: 0.7, letterSpacing: 0.3 },
  stripValue: {
    fontSize: 10.5,
    fontWeight: '800',
    color: CARD.stripInk,
    fontVariant: ['tabular-nums'],
  },
});
