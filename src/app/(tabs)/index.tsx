import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ResultBadge } from '@/components/badge';
import { PetAvatar } from '@/components/pet-avatar';
import { Screen } from '@/components/screen';
import { SectionTitle } from '@/components/section-title';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { FACILITIES } from '@/data/mock';
import { CATEGORY_LABEL, satisfactionMood, sinceText, type Pet } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { DENIAL_REASON_LABEL, useAppStore } from '@/store/app-store';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

/** 시간대별 인사 — 홈을 열 때마다 조금씩 다른 온기를 준다 */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '편안한 밤이에요 🌙';
  if (h < 11) return '좋은 아침이에요 🐾';
  if (h < 17) return '좋은 오후예요 🐾';
  if (h < 21) return '좋은 저녁이에요 🐾';
  return '편안한 밤이에요 🌙';
}

export default function HomeScreen() {
  const p = usePalette();
  const router = useRouter();
  const { pets, checks, plannedDenialAlerts, upcomingVaccinations } = useAppStore();
  const alerts = plannedDenialAlerts();
  const vax = upcomingVaccinations();

  return (
    <Screen eyebrow={greeting()} title="반려동물 여권" subtitle="아이마다 좋아한 장소를 한눈에 확인하세요.">
      {/* 가려던 곳(판별받은 시설)에 거부가 뜨면 홈에서 먼저 알린다 */}
      {alerts.length > 0 && (
        <View style={styles.alertWrap}>
          {alerts.map(({ facility, report }) => (
            <Pressable
              key={facility.facilityId}
              onPress={() =>
                router.push({ pathname: '/facility/[id]', params: { id: String(facility.facilityId) } })
              }
              style={({ pressed }) => [
                styles.alertCard,
                { backgroundColor: pressed ? p.dangerSoft : p.card, borderColor: p.danger },
              ]}>
              <View style={[styles.alertIcon, { backgroundColor: p.dangerSoft }]}>
                <Ionicons name="notifications" size={18} color={p.danger} />
              </View>
              <View style={styles.alertText}>
                <Text style={[styles.alertTitle, { color: p.danger }]}>
                  가려던 곳에 거부가 떴어요
                </Text>
                <Text style={[styles.alertBody, { color: p.ink }]} numberOfLines={2}>
                  {facility.name} · {report.createdAt ? sinceText(report.createdAt) : ''}
                  {report.reason ? ` · ${DENIAL_REASON_LABEL[report.reason]}` : ''} — 방문 전 확인하세요
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={p.danger} />
            </Pressable>
          ))}
        </View>
      )}

      {/* 다가오는(또는 지난) 예방접종 — 개·고양이 부스터 리마인더 */}
      {vax.length > 0 && (
        <View style={styles.alertWrap}>
          {vax.map(({ pet, dday, date }) => {
            const overdue = dday < 0;
            const tone = overdue ? p.danger : p.accent;
            const toneSoft = overdue ? p.dangerSoft : p.accentSoft;
            return (
              <Pressable
                key={pet.petId}
                onPress={() => router.push('/calendar')}
                style={({ pressed }) => [
                  styles.alertCard,
                  { backgroundColor: pressed ? toneSoft : p.card, borderColor: tone },
                ]}>
                <View style={[styles.alertIcon, { backgroundColor: toneSoft }]}>
                  <Ionicons name="medkit" size={18} color={tone} />
                </View>
                <View style={styles.alertText}>
                  <Text style={[styles.alertTitle, { color: tone }]}>
                    {overdue ? `${pet.name} 접종 기한이 지났어요` : `${pet.name} 예방접종이 다가와요`}
                  </Text>
                  <Text style={[styles.alertBody, { color: p.ink }]} numberOfLines={2}>
                    다음 접종 {date} · {overdue ? `${-dday}일 지남` : `D-${dday}`} — 캘린더에서 확인하세요
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={tone} />
              </Pressable>
            );
          })}
        </View>
      )}

      {pets.length === 0 ? (
        <View style={[styles.empty, { borderColor: p.line }]}>
          <Ionicons name="paw" size={30} color={p.accent} />
          <Text style={[styles.emptyText, { color: p.muted }]}>
            내 반려동물 탭에서{'\n'}아이를 먼저 등록해 주세요.
          </Text>
        </View>
      ) : (
        pets.map((pet) => <PetPassport key={pet.petId} pet={pet} />)
      )}

      {checks.length > 0 && (
        <>
          <SectionTitle title="최근 판별 이력" caption={`${checks.length}건`} />
          <View style={styles.histList}>
            {checks.slice(0, 5).map((c) => {
              const facility = FACILITIES.find((f) => f.facilityId === c.facilityId);
              const names = c.verdicts.map((v) => pets.find((x) => x.petId === v.petId)?.name).filter(Boolean);
              return (
                <Pressable
                  key={c.checkId}
                  onPress={() =>
                    router.push({ pathname: '/facility/[id]', params: { id: String(c.facilityId) } })
                  }
                  style={({ pressed }) => [
                    styles.histCard,
                    { backgroundColor: p.card, borderColor: p.line, opacity: pressed ? 0.92 : 1 },
                  ]}>
                  <View style={styles.histTop}>
                    <Text style={[styles.histName, { color: p.ink }]} numberOfLines={1}>
                      {facility?.name ?? '알 수 없는 시설'}
                    </Text>
                    <ResultBadge result={c.overall} />
                  </View>
                  <Text style={[styles.histMeta, { color: p.muted }]}>
                    {names.join(' · ')} · {formatDate(c.createdAt)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </Screen>
  );
}

/** 신분증(여권) 형태의 반려동물 카드 — 핑크 테두리, 원형 프로필, 좋아한 곳 TOP 3 */
function PetPassport({ pet }: { pet: Pet }) {
  const p = usePalette();
  const router = useRouter();
  const { topPlacesForPet } = useAppStore();
  const top = topPlacesForPet(pet.petId, 3);

  const medal = ['🥇', '🥈', '🥉'];

  return (
    <View style={[styles.card, CardShadow, { borderColor: p.accent, backgroundColor: p.card }]}>
      <View style={styles.idRow}>
        <View style={[styles.avatarRing, { borderColor: p.accentSoft }]}>
          <PetAvatar pet={pet} size={56} />
        </View>
        <View style={styles.idText}>
          <Text style={[styles.petName, { color: p.ink }]}>{pet.name}</Text>
          <View style={[styles.passTag, { backgroundColor: p.accentSoft }]}>
            <Ionicons name="paw" size={11} color={p.accent} />
            <Text style={[styles.passTagText, { color: p.accent }]}>프리펫스</Text>
          </View>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: p.line }]} />

      <Text style={[styles.favTitle, { color: p.muted }]}>이 아이가 좋아한 곳 TOP 3</Text>

      {top.length === 0 ? (
        <Text style={[styles.favEmpty, { color: p.muted }]}>
          아직 기록이 없어요. 방문한 곳에서 만족도를 남기면 여기에 모여요.
        </Text>
      ) : (
        <View style={styles.favList}>
          {top.map((item, i) => {
            const mood = satisfactionMood(item.score);
            return (
              <View
                key={item.facility.facilityId}
                onTouchEnd={() =>
                  router.push({
                    pathname: '/facility/[id]',
                    params: { id: String(item.facility.facilityId) },
                  })
                }
                style={styles.favRow}>
                <Text style={styles.medal}>{medal[i]}</Text>
                <View style={styles.favInfo}>
                  <Text style={[styles.favName, { color: p.ink }]} numberOfLines={1}>
                    {item.facility.name}
                  </Text>
                  <Text style={[styles.favCat, { color: p.muted }]}>
                    {CATEGORY_LABEL[item.facility.category]}
                  </Text>
                </View>
                <View style={[styles.scorePill, { backgroundColor: p.accentSoft }]}>
                  <Text style={styles.scoreEmoji}>{mood.emoji}</Text>
                  <Text style={[styles.scoreValue, { color: p.accent }]}>
                    {item.score.toFixed(1)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  alertWrap: { gap: Spacing.sm },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  alertIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertText: { flex: 1, gap: 2 },
  alertTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  alertBody: { fontSize: 12.5, lineHeight: 18 },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 2,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  avatarRing: {
    borderRadius: Radius.full,
    borderWidth: 3,
    padding: 2,
  },
  idText: { gap: 6 },
  petName: { fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  passTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  passTagText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  divider: { height: 1 },
  favTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  favEmpty: { fontSize: 13, lineHeight: 20 },
  favList: { gap: Spacing.sm },
  favRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  medal: { fontSize: 20, width: 26, textAlign: 'center' },
  favInfo: { flex: 1, gap: 1 },
  favName: { fontSize: 15, fontWeight: '700' },
  favCat: { fontSize: 11.5 },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  scoreEmoji: { fontSize: 13 },
  scoreValue: { fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] },
  empty: {
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    paddingVertical: 56,
  },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  histList: { gap: Spacing.sm },
  histCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, gap: 5 },
  histTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  histName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, flexShrink: 1 },
  histMeta: { fontSize: 12 },
});
