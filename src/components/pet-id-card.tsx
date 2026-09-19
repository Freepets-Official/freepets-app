import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { PetAvatar } from '@/components/pet-avatar';
import { Text } from '@/components/text';
import { TierPaw } from '@/components/tier-paw';
import { Radius, Spacing } from '@/constants/theme';
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
 * 반려동물 주민등록증 — 홈의 아이 카드.
 *
 * 등록한 정보가 그대로 신분증 서식에 얹힌다. 게임 네임플레이트였던 예전 카드와 달리
 * "이 아이가 어떤 아이인지"가 한 장에 정리돼, 매장에서 보여주기도 자연스럽다.
 *
 * 색은 **양쪽 테마에서 같다.** 신분증이라는 물건 자체가 종이 질감이라, 다크 모드에서
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

function Field({ label, en, value, strong }: { label: string; en: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
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
  const { topPlacesForPet, gamification, account } = useAppStore();
  const top = topPlacesForPet(pet.petId, 3);
  const progress = gamification ? levelProgress(gamification) : null;
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

      <View style={styles.head}>
        <View style={styles.headTexts}>
          <Text style={styles.title}>반려동물 주민등록증</Text>
          <Text style={styles.titleEn}>Pet Resident Registration Card</Text>
        </View>
        {/* 홀로그램 씰 자리 — 레벨 배지(발바닥). 레벨이 오르면 색·선명도가 바뀐다 */}
        {gamification && <TierPaw gamification={gamification} size={54} />}
      </View>

      <View style={styles.body}>
        <View style={styles.photoCol}>
          <View style={styles.photoRing}>
            <View style={styles.photoInner}>
              <PetAvatar pet={pet} size={72} />
            </View>
          </View>
          <Text style={styles.kind}>{PET_KIND_LABEL[pet.kind]}</Text>
        </View>

        <View style={styles.fields}>
          <Field label="이름" en="NAME" value={pet.name} strong />
          <View style={styles.fieldRow}>
            <Field label="성별" en="SEX" value={pet.gender ? PET_GENDER_LABEL[pet.gender] : '미등록'} />
            <Field label="나이" en="AGE" value={ageText} />
          </View>
          <View style={styles.fieldRow}>
            <Field label="품종" en="BREED" value={pet.species || '미등록'} />
            <Field label="몸무게" en="WEIGHT" value={`${pet.weight}kg · ${BREED_SIZE_LABEL[pet.breedSize]}`} />
          </View>
          <View style={styles.fieldRow}>
            <Field label="생년월일" en="DATE OF BIRTH" value={birthText} />
            <Field label="예방접종" en="VACCINATION" value={vaccinationText} />
          </View>
        </View>
      </View>

      <View style={styles.favBlock}>
        <Text style={styles.favTitle}>
          최애 장소 <Text style={styles.fieldLabelEn}>TOP 3</Text>
        </Text>
        {top.length === 0 ? (
          <Text style={styles.favEmpty}>아직 기록이 없어요. 다녀온 곳에서 만족도를 남기면 여기에 채워져요.</Text>
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
              <Text style={styles.favCat}>{CATEGORY_LABEL[item.facility.category]}</Text>
              <Text style={styles.favScore}>
                {satisfactionMood(item.score).emoji} {item.score.toFixed(1)}
              </Text>
            </View>
          ))
        )}
      </View>

      {/*
        레벨·XP·티어는 **계정(집사) 값**이다. 아이가 여럿이어도 같은 숫자라, 아이 정보 사이에
        두면 이 아이의 레벨로 읽힌다. 신분증의 "발급기관" 자리처럼 보호자 칸으로 분리한다.
      */}
      {gamification && progress && (
        <View style={styles.guardian}>
          <View style={styles.guardianHead}>
            <Text style={styles.guardianLabel}>
              보호자 <Text style={styles.fieldLabelEn}>GUARDIAN</Text>
            </Text>
            <Text style={styles.guardianName} numberOfLines={1}>
              {account.nickname}
            </Text>
          </View>
          <View style={styles.guardianLevel}>
            <Text style={styles.guardianLv}>집사 Lv.{progress.level}</Text>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${Math.max(5, progress.ratio * 100)}%` }]} />
            </View>
            <Text style={styles.xpText}>
              {progress.maxed ? '최고 레벨' : `${progress.into.toLocaleString()}/${progress.step.toLocaleString()}`}
            </Text>
          </View>
          <Text style={styles.guardianTier} numberOfLines={1}>
            {tierName(gamification)}
          </Text>
        </View>
      )}

      <View style={styles.strip}>
        <Text style={styles.stripLabel}>발급일 ISSUED</Text>
        <Text style={styles.stripValue}>
          {issuedText} · 반갑꼬리 No. {serial}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  titleEn: { fontSize: 10, fontWeight: '700', color: CARD.sub, letterSpacing: 0.2 },
  body: { flexDirection: 'row', gap: Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  photoCol: { alignItems: 'center', gap: 6 },
  photoRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: CARD.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD.paperDeep,
  },
  photoInner: { borderWidth: 2, borderColor: CARD.paper, borderRadius: 38, overflow: 'hidden' },
  kind: { fontSize: 10.5, fontWeight: '800', color: CARD.sub },
  fields: { flex: 1, gap: 9 },
  fieldRow: { flexDirection: 'row', gap: Spacing.md },
  field: { flex: 1, gap: 1 },
  fieldLabel: { fontSize: 10, fontWeight: '800', color: CARD.sub },
  fieldLabelEn: { fontSize: 9, fontWeight: '700', color: CARD.sub, opacity: 0.8 },
  fieldValue: { fontSize: 13.5, fontWeight: '800', color: CARD.ink },
  fieldValueStrong: { fontSize: 18, fontWeight: '900', color: CARD.ink, letterSpacing: -0.4 },
  xpTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: CARD.paperDeep, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 3, backgroundColor: CARD.gold },
  xpText: { fontSize: 10, fontWeight: '700', color: CARD.sub, fontVariant: ['tabular-nums'] },
  guardian: {
    borderTopWidth: 1,
    borderTopColor: CARD.line,
    marginHorizontal: Spacing.lg,
    paddingTop: 9,
    paddingBottom: Spacing.md,
    gap: 5,
  },
  guardianHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  guardianLabel: { fontSize: 10, fontWeight: '800', color: CARD.sub },
  guardianName: { flexShrink: 1, fontSize: 13, fontWeight: '900', color: CARD.ink },
  guardianLevel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  guardianLv: { fontSize: 13, fontWeight: '900', color: CARD.ink, fontVariant: ['tabular-nums'] },
  guardianTier: { fontSize: 10.5, fontWeight: '700', color: CARD.gold },
  favBlock: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: 5 },
  favTitle: { fontSize: 10.5, fontWeight: '800', color: CARD.sub },
  favEmpty: { fontSize: 11.5, lineHeight: 17, color: CARD.sub },
  favRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  medal: { fontSize: 12 },
  favName: { flexShrink: 1, fontSize: 12.5, fontWeight: '800', color: CARD.ink },
  favCat: { fontSize: 10.5, fontWeight: '700', color: CARD.sub },
  favScore: { marginLeft: 'auto', fontSize: 11.5, fontWeight: '800', color: CARD.ink, fontVariant: ['tabular-nums'] },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD.strip,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 9,
  },
  stripLabel: { fontSize: 9.5, fontWeight: '800', color: CARD.stripInk, opacity: 0.7 },
  stripValue: { fontSize: 11.5, fontWeight: '800', color: CARD.stripInk, fontVariant: ['tabular-nums'] },
});
