import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

type IconName = ComponentProps<typeof Ionicons>['name'];
const RADII = [1, 3, 5, 10];

export default function SettingsScreen() {
  const p = usePalette();
  const router = useRouter();
  const { settings, updateSettings, businessRegs, session, availableProfiles, switchProfile, logout } =
    useAppStore();
  const regCount = Object.keys(businessRegs).length;
  const hasOwnerProfile = availableProfiles.includes('owner');

  return (
    <Screen eyebrow="설정" title="설정">
      {/* 계정 */}
      <Group title="계정">
        {hasOwnerProfile && (
          <Row
            icon="swap-horizontal-outline"
            label="프로필 전환"
            sub="일반 ↔ 사업자 프로필 선택"
            onPress={switchProfile}
            chevron
          />
        )}
        <Row icon="person-circle-outline" label="프로필 관리" onPress={() => {}} chevron />
        <Row
          icon="mail-outline"
          label="계정 정보"
          sub={session.email ?? 'sjwtlswodn@naver.com'}
          onPress={() => {}}
          chevron
          last
        />
      </Group>

      {/* 사업자 (앱 특화) */}
      <Group title="사업자" caption="프리펫스 전용">
        <Row
          icon="storefront-outline"
          label="내 매장 조건 등록"
          sub={regCount > 0 ? `${regCount}곳 확정 관리 중` : '사장님이 직접 확정하면 손님에게 확정 정보로 보여져요'}
          onPress={() => router.push('/business')}
          chevron
        />
        <Row
          icon="restaurant-outline"
          label="우리 식당, 반려동물 받기"
          sub="2026년 3월 신규 · 음식점 동반 신고제 안내부터 등록까지"
          onPress={() => router.push('/restaurant')}
          chevron
          last
        />
      </Group>

      {/* 탐색 반경 (앱 특화) */}
      <Group title="탐색 반경" caption="프리펫스 전용">
        <View style={styles.block}>
          <Text style={[styles.blockLabel, { color: p.ink }]}>주변 검색 반경</Text>
          <Text style={[styles.blockHint, { color: p.muted }]}>
            내 주변 시설을 얼마나 넓게 볼지 정해요.
          </Text>
          <View style={styles.chips}>
            {RADII.map((km) => (
              <Chip
                key={km}
                label={`${km}km`}
                selected={settings.searchRadiusKm === km}
                onPress={() => updateSettings({ searchRadiusKm: km })}
              />
            ))}
          </View>
        </View>
      </Group>

      {/* 탐색 (앱 특화) */}
      <Group title="탐색 · 판별" caption="프리펫스 전용">
        <ToggleRow
          icon="eye-off-outline"
          label="동반 불가 시설 숨기기"
          sub="탐색에서 동반 가능한 곳만 보여줘요"
          value={settings.hideDenied}
          onChange={(v) => updateSettings({ hideDenied: v })}
        />
        <ToggleRow
          icon="sunny-outline"
          label="계절 맞춤 팁 표시"
          sub="체크리스트에 계절별 주의사항을 더해요"
          value={settings.seasonalTips}
          onChange={(v) => updateSettings({ seasonalTips: v })}
          last
        />
      </Group>

      {/* 알림 */}
      <Group title="알림">
        <ToggleRow
          icon="notifications-outline"
          label="푸시 알림"
          value={settings.notifPush}
          onChange={(v) => updateSettings({ notifPush: v })}
        />
        <ToggleRow
          icon="megaphone-outline"
          label="제보 반영·포인트 알림"
          sub="내 제보가 반영되면 알려드려요"
          value={settings.notifReport}
          onChange={(v) => updateSettings({ notifReport: v })}
        />
        <ToggleRow
          icon="location-outline"
          label="주변 새 시설 알림"
          sub="자주 가는 지역에 동반 가능 시설이 생기면"
          value={settings.notifNearby}
          onChange={(v) => updateSettings({ notifNearby: v })}
        />
        <ToggleRow
          icon="gift-outline"
          label="혜택·마케팅 알림"
          value={settings.notifMarketing}
          onChange={(v) => updateSettings({ notifMarketing: v })}
          last
        />
      </Group>

      {/* 일반 */}
      <Group title="일반">
        <Row icon="language-outline" label="언어" sub="한국어" onPress={() => {}} chevron />
        <Row icon="moon-outline" label="화면 테마" sub="라이트 고정" onPress={() => {}} />
        <Row icon="lock-closed-outline" label="개인정보 · 위치 권한" onPress={() => {}} chevron />
        <Row icon="trash-outline" label="캐시 삭제" sub="12.4MB" onPress={() => {}} last />
      </Group>

      {/* 정보 */}
      <Group title="정보 · 지원">
        <Row icon="notifications-circle-outline" label="공지사항" onPress={() => {}} chevron />
        <Row icon="chatbubble-ellipses-outline" label="문의하기" onPress={() => {}} chevron />
        <Row icon="document-text-outline" label="이용약관" onPress={() => {}} chevron />
        <Row icon="shield-checkmark-outline" label="개인정보 처리방침" onPress={() => {}} chevron />
        <Row icon="information-circle-outline" label="앱 버전" sub="1.0.0" last />
      </Group>

      {/* 계정 관리 */}
      <Group title="계정 관리">
        <Row icon="log-out-outline" label="로그아웃" onPress={logout} tint />
        <Row icon="person-remove-outline" label="회원 탈퇴" onPress={() => {}} tint last />
      </Group>

      <Text style={[styles.footer, { color: p.muted }]}>프리펫스 · 반려동물 동반여행 AI 판별</Text>
    </Screen>
  );
}

function Group({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
}) {
  const p = usePalette();
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <Text style={[styles.groupTitle, { color: p.muted }]}>{title}</Text>
        {caption ? (
          <View style={[styles.groupTag, { backgroundColor: p.accentSoft }]}>
            <Text style={[styles.groupTagText, { color: p.accent }]}>{caption}</Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.groupCard, CardShadow, { backgroundColor: p.card, borderColor: p.line }]}>
        {children}
      </View>
    </View>
  );
}

function Row({
  icon,
  label,
  sub,
  onPress,
  chevron,
  tint,
  last,
}: {
  icon: IconName;
  label: string;
  sub?: string;
  onPress?: () => void;
  chevron?: boolean;
  tint?: boolean;
  last?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: 1, borderBottomColor: p.line },
        { opacity: pressed && onPress ? 0.6 : 1 },
      ]}>
      <Ionicons name={icon} size={20} color={tint ? p.accent : p.muted} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: tint ? p.accent : p.ink }]}>{label}</Text>
        {sub ? <Text style={[styles.rowSub, { color: p.muted }]}>{sub}</Text> : null}
      </View>
      {chevron && <Ionicons name="chevron-forward" size={17} color={p.muted} />}
    </Pressable>
  );
}

function ToggleRow({
  icon,
  label,
  sub,
  value,
  onChange,
  last,
}: {
  icon: IconName;
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  const p = usePalette();
  return (
    <View
      style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: p.line }]}>
      <Ionicons name={icon} size={20} color={p.muted} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: p.ink }]}>{label}</Text>
        {sub ? <Text style={[styles.rowSub, { color: p.muted }]}>{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: p.accent }} thumbColor="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.sm },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  groupTitle: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.3 },
  groupTag: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  groupTagText: { fontSize: 10, fontWeight: '800' },
  groupCard: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
  },
  rowText: { flex: 1, gap: 1 },
  rowLabel: { fontSize: 14.5, fontWeight: '700' },
  rowSub: { fontSize: 12 },
  block: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: 8 },
  blockLabel: { fontSize: 14.5, fontWeight: '700' },
  blockHint: { fontSize: 12, marginTop: -4 },
  blockDivider: { height: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 2 },
  footer: { fontSize: 11.5, textAlign: 'center', paddingTop: Spacing.sm },
});
