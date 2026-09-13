import Ionicons from '@expo/vector-icons/Ionicons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Alert, Linking, Modal, Platform, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Text } from '@/components/text';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { SUPPORT_EMAIL, SUPPORT_MAIL_SUBJECT } from '@/constants/contact';
import { CardShadow, Radius, Spacing, type ThemeMode } from '@/constants/theme';
import { FONT_SIZE_LABEL, type FontSizeMode } from '@/data/types';
import { useColorScheme, usePalette } from '@/hooks/use-theme';
import { ApiError, accountApi } from '@/lib/api';
import { useAppStore } from '@/store/app-store';

type IconName = ComponentProps<typeof Ionicons>['name'];
const RADII = [1, 3, 5, 10];

const THEME_MODES: { key: ThemeMode; label: string; desc: string; icon: IconName }[] = [
  { key: 'light', label: '라이트', desc: '항상 밝게', icon: 'sunny-outline' },
  { key: 'dark', label: '다크', desc: '항상 어둡게', icon: 'moon-outline' },
  { key: 'auto', label: '자동', desc: '저녁~새벽엔 다크로', icon: 'contrast-outline' },
];
const THEME_MODE_LABEL: Record<ThemeMode, string> = { light: '라이트', dark: '다크', auto: '자동' };

/**
 * 공지사항을 1.0에서 숨긴다.
 *
 * 조회 API가 없어 화면이 하드코딩된 4건을 보여주는데, 날짜가 2026-07~08로 출시 전이라
 * 있지도 않은 과거 업데이트 이력이 되고 「정기 서버 점검」은 하지도 않는 점검이다.
 * 서버 공지 API가 붙는 다음 업데이트에 되살린다 — 화면과 라우트는 그대로 둔다.
 */
const SHOW_NOTICES = false;

/**
 * 사업자(사장님) 기능을 1.0에서 숨긴다.
 *
 * 백엔드가 사업자 인증과 매장 등록까지는 열었지만, **사장님 대시보드·혜택·프로모션·통계는
 * 아직 구현 시작 전이다**(백엔드 이슈 #85). 지금 그 네 화면은 서버 호출이 한 건도 없고,
 * 매장 등록도 React state에만 남아 앱을 다시 켜면 사라진다 — 심사자가 「우리 식당,
 * 반려동물 받기」를 끝까지 밟으면 아무 동작 없는 화면과 빈 통계를 보게 된다.
 * 보이는 것이 작동하지 않으면 가이드라인 2.1이다.
 *
 * 매장 등록만 열고 대시보드를 감추는 절충은 하지 않는다 — 등록은 되는데 관리할 데가
 * 없으면 "등록 후 무엇을 하나"라는 질문을 심사자에게 남긴다.
 *
 * 화면과 라우트는 지우지 않는다. 1.1에서 verify·claim·profiles 파생까지 묶어 제대로 연다.
 */
const SHOW_BUSINESS = false;

export default function SettingsScreen() {
  const p = usePalette();
  const router = useRouter();
  const { settings, updateSettings, businessRegs, session, account, availableProfiles, switchProfile, logout } =
    useAppStore();
  const regCount = Object.keys(businessRegs).length;
  const hasOwnerProfile = SHOW_BUSINESS && availableProfiles.includes('owner');
  /**
   * 되돌릴 수 없는 동작 앞에 한 번 묻는다.
   *
   * 로그아웃과 탈퇴가 같은 틀을 쓴다 — 따로 만들면 한쪽 문구만 고치고 다른 쪽을 잊는다.
   */
  const [confirm, setConfirm] = useState<{
    title: string;
    body: string;
    action: string;
    danger?: boolean;
    /** 탈퇴처럼 비밀번호 확인이 필요한 동작에서만 입력란을 띄운다 */
    askPassword?: boolean;
    onConfirm: (password?: string) => void | Promise<void>;
  } | null>(null);
  const [confirmPw, setConfirmPw] = useState('');
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const scheme = useColorScheme();

  // 앱 잠금 켤 때: 생체인증 등록 여부 확인 후 활성화 (네이티브만)
  const toggleAppLock = async (v: boolean) => {
    if (!v) {
      updateSettings({ appLock: false });
      return;
    }
    const hardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hardware || !enrolled) {
      Alert.alert('생체인증을 사용할 수 없어요', '기기 설정에서 Face ID·지문을 먼저 등록해주세요.');
      return;
    }
    updateSettings({ appLock: true });
  };

  return (
    <Screen
      eyebrow="반갑꼬리"
      title="설정"
      subtitle="계정·알림·화면을 원하는 대로 맞춰요.">
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
        <Row
          icon="person-circle-outline"
          label="프로필 관리"
          sub={account.nickname}
          onPress={() => router.push('/profile-edit')}
          chevron
        />
        {/*
          네이버·카카오는 앱에 이메일을 주지 않는다(구글만 주고, 애플은 최초 1회뿐).
          서버 회원정보에도 이메일이 없어 복원하면 값이 빈다. 예전에는 그 자리에
          없는 주소를 지어 넣어, 있지도 않은 계정을 계정 정보라고 보여줬다.
        */}
        <Row
          icon="mail-outline"
          label="계정 정보"
          sub={session.email || '소셜 계정으로 로그인'}
          last
        />
      </Group>

      {/* 사업자 (앱 특화) */}
      {SHOW_BUSINESS && (
      <Group title="사업자" caption="반갑꼬리 전용">
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
      )}

      {/* 글씨 크기 — 앱 전체 텍스트에 같은 배율로 걸린다 */}
      <Group title="화면" caption="반갑꼬리 전용">
        <View style={styles.block}>
          <Text style={[styles.blockLabel, { color: p.ink }]}>글씨 크기</Text>
          <Text style={[styles.blockHint, { color: p.muted }]}>
            앱 전체 글씨가 함께 커지거나 작아져요.
          </Text>
          <View style={styles.chips}>
            {(['small', 'normal', 'large'] as FontSizeMode[]).map((mode) => (
              <Chip
                key={mode}
                label={FONT_SIZE_LABEL[mode]}
                selected={settings.fontSize === mode}
                onPress={() => updateSettings({ fontSize: mode })}
              />
            ))}
          </View>
        </View>
      </Group>

      {/* 탐색 반경 (앱 특화) */}
      <Group title="탐색 반경" caption="반갑꼬리 전용">
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
      <Group title="탐색 · 판별" caption="반갑꼬리 전용">
        <ToggleRow
          icon="paw-outline"
          label="동반 가능만 보기"
          sub="관광공사가 동반 가능으로 확인한 곳만 (전체의 약 20%)"
          value={settings.onlyPetInfo}
          onChange={(v) => updateSettings({ onlyPetInfo: v })}
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

      {/* 캘린더 (앱 특화) */}
      <Group title="캘린더" caption="반갑꼬리 전용">
        <ToggleRow
          icon="airplane-outline"
          label="여행 일정 자동 기록"
          sub="동반 방문을 확정하면 캘린더에 여행 일정으로 남겨요"
          value={settings.autoTravelLog}
          onChange={(v) => updateSettings({ autoTravelLog: v })}
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
        {/*
          종류별 알림 토글(제보 반영·주변 새 시설·혜택)은 1.0에서 감춘다.
          서버가 알림을 종류로 나눠 보내지 않아서, 켜고 꺼도 실제로 오는 알림이 바뀌지 않는다.
          동작하지 않는 스위치를 보여주느니 전체 알림 토글 하나만 둔다.
          서버가 종류를 구분하게 되면 되살린다.
        */}
      </Group>

      {/* 보안 — 생체인증 지원 기기(네이티브)에서만 */}
      {Platform.OS !== 'web' && (
        <Group title="보안">
          <ToggleRow
            icon="finger-print"
            label="앱 잠금 · 생체인증"
            sub="앱을 열거나 되돌아올 때 Face ID·지문으로 잠금 해제"
            value={settings.appLock}
            onChange={toggleAppLock}
            last
          />
        </Group>
      )}

      {/* 일반 */}
      <Group title="일반">
        <Row icon="language-outline" label="언어" sub="한국어" />
        <Row
          icon="moon-outline"
          label="화면 모드"
          sub={
            settings.themeMode === 'auto'
              ? `자동 · 지금 ${scheme === 'dark' ? '다크' : '라이트'}`
              : THEME_MODE_LABEL[settings.themeMode]
          }
          onPress={() => setThemeOpen(true)}
          chevron
        />
        <Row
          icon="lock-closed-outline"
          label="개인정보 · 위치 권한"
          onPress={() => router.push({ pathname: '/policy', params: { tab: 'privacy' } })}
          chevron
          last
        />
        {/*
          「캐시 삭제」를 뺀다. 고정값 12.4MB를 0MB로 바꿔 보여주기만 했고 실제로 지우는
          것이 없었다. 없는 숫자를 지웠다고 말하는 화면은 두지 않는다.
        */}
      </Group>

      {/* 정보 */}
      <Group title="정보 · 지원">
        {SHOW_NOTICES && (
          <Row
            icon="notifications-circle-outline"
            label="공지사항"
            onPress={() => router.push('/notices')}
            chevron
          />
        )}
        <Row
          icon="chatbubble-ellipses-outline"
          label="문의하기"
          sub="메일로 문의 보내기"
          onPress={() =>
            Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUPPORT_MAIL_SUBJECT)}`)
          }
          chevron
        />
        <Row
          icon="document-text-outline"
          label="이용약관"
          onPress={() => router.push('/policy')}
          chevron
        />
        <Row
          icon="shield-checkmark-outline"
          label="개인정보 처리방침"
          onPress={() => router.push({ pathname: '/policy', params: { tab: 'privacy' } })}
          chevron
        />
        <Row icon="information-circle-outline" label="앱 버전" sub="1.0.0" last />
      </Group>

      {/* 계정 관리 */}
      <Group title="계정 관리">
        <Row
          icon="log-out-outline"
          label="로그아웃"
          onPress={() =>
            setConfirm({
              title: '로그아웃할까요?',
              // 도장은 기기에만 있어 로그아웃하면 지워진다. 미리 말하지 않으면
              // 다시 로그인했을 때 사라진 걸 보고서야 알게 된다.
              body: '반려동물·판별 이력은 다시 로그인하면 그대로 있어요.\n다만 이 기기에 모은 여권 도장은 지워집니다.',
              action: '로그아웃',
              onConfirm: () => logout(),
            })
          }
          tint
        />
        <Row
          icon="person-remove-outline"
          label="회원 탈퇴"
          onPress={() =>
            setConfirm({
              title: '정말 탈퇴하시겠어요?',
              // 실제로 지워지는 것만 적는다. 작성한 리뷰·공개 코스·거부 제보는 남고
              // 작성자 이름만 "탈퇴한 계정"으로 바뀐다(api-specs/user.md 5번).
              body:
                '탈퇴하면 계정과 등록한 반려동물·일정이 삭제되고 되돌릴 수 없어요.\n' +
                '이미 남긴 리뷰와 공개한 코스는 그대로 남고, 작성자만 「탈퇴한 계정」으로 바뀝니다.',
              action: '탈퇴하기',
              danger: true,
              askPassword: true,
              onConfirm: async (password) => {
                // 서버에서 실제로 지운 뒤에 세션을 정리한다. 순서가 바뀌면 토큰이 없어
                // 삭제 요청 자체가 401이 된다.
                await accountApi.remove(password);
                // 서버가 탈퇴 시점에 푸시 토큰을 이미 지웠다. 다시 해제하려 들면
                // 남은 토큰으로 MEMBER4007만 받고 최대 3초를 기다린다.
                logout({ skipPushUnregister: true });
              },
            })
          }
          tint
          last
        />
      </Group>

      <Text style={[styles.footer, { color: p.muted }]}>반갑꼬리 · 반려동물 동반여행 AI 판별</Text>

      {/* 로그아웃·탈퇴 공통 확인 */}
      <Modal
        visible={confirm !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirm(null)}>
        <Pressable style={styles.backdrop} onPress={() => setConfirm(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: p.card }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: p.ink }]}>{confirm?.title}</Text>
            <Text style={[styles.sheetBody, { color: p.muted }]}>{confirm?.body}</Text>
            {confirm?.askPassword && (
              <>
                <TextInput
                  value={confirmPw}
                  onChangeText={setConfirmPw}
                  placeholder="비밀번호"
                  placeholderTextColor={p.muted}
                  secureTextEntry
                  autoCapitalize="none"
                  style={[styles.pwInput, { borderColor: p.line, backgroundColor: p.surface, color: p.ink }]}
                />
                {/* 소셜로 가입하면 비밀번호가 없다. 비워둘 수 있다는 걸 미리 말한다 */}
                <Text style={[styles.pwHint, { color: p.muted }]}>
                  소셜 계정으로 가입하셨다면 비워두세요.
                </Text>
              </>
            )}
            {confirmError && <Text style={[styles.pwError, { color: p.danger }]}>{confirmError}</Text>}
            <Pressable
              disabled={confirmBusy}
              onPress={async () => {
                if (!confirm) return;
                setConfirmBusy(true);
                setConfirmError(null);
                try {
                  // 비밀번호는 원문 그대로 보낸다. 가입·로그인이 trim하지 않으므로 여기서만
                  // 다듬으면, 앞뒤 공백이 든 비밀번호로 가입한 사람은 탈퇴가 막힌다.
                  await confirm.onConfirm(confirmPw || undefined);
                  // 성공했을 때만 닫는다. 실패했는데 닫으면 왜 안 됐는지 알 수 없다.
                  setConfirm(null);
                  setConfirmPw('');
                } catch (e) {
                  setConfirmError(
                    e instanceof ApiError ? e.message : '처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
                  );
                } finally {
                  setConfirmBusy(false);
                }
              }}
              style={[styles.withdrawBtn, { backgroundColor: confirm?.danger ? p.danger : p.accent }]}>
              <Text style={[styles.withdrawBtnText, { color: '#FFFFFF' }]}>
                {confirmBusy ? '처리 중…' : confirm?.action}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setConfirm(null);
                setConfirmPw('');
                setConfirmError(null);
              }}
              style={styles.cancelBtn}>
              <Text style={[styles.cancelBtnText, { color: p.muted }]}>취소</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 화면 모드 선택 */}
      <Modal
        visible={themeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setThemeOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setThemeOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: p.card }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: p.ink }]}>화면 모드</Text>
            <Text style={[styles.sheetBody, { color: p.muted }]}>
              자동은 저녁(19시)부터 새벽(6시)까지 다크로 바뀌어요.
            </Text>
            {THEME_MODES.map((m) => {
              const on = settings.themeMode === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => {
                    updateSettings({ themeMode: m.key });
                    setThemeOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.themeOption,
                    {
                      borderColor: on ? p.accent : p.line,
                      backgroundColor: on ? p.accentSoft : pressed ? p.surface : 'transparent',
                    },
                  ]}>
                  <Ionicons name={m.icon} size={20} color={on ? p.accent : p.muted} />
                  <View style={styles.themeOptionText}>
                    <Text style={[styles.themeOptionLabel, { color: on ? p.accent : p.ink }]}>{m.label}</Text>
                    <Text style={[styles.themeOptionDesc, { color: p.muted }]}>{m.desc}</Text>
                  </View>
                  {on && <Ionicons name="checkmark-circle" size={20} color={p.accent} />}
                </Pressable>
              );
            })}
            <Pressable onPress={() => setThemeOpen(false)} style={styles.cancelBtn}>
              <Text style={[styles.cancelBtnText, { color: p.muted }]}>닫기</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  sheetTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  pwInput: {
    borderWidth: 1, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: 12,
    fontSize: 15, marginTop: Spacing.md,
  },
  pwHint: { fontSize: 12.5, marginTop: 6 },
  pwError: { fontSize: 13, fontWeight: '600', marginTop: 10 },
  sheetBody: { fontSize: 13, lineHeight: 20, marginBottom: Spacing.sm },
  withdrawBtn: { alignItems: 'center', borderRadius: Radius.md, paddingVertical: 15 },
  withdrawBtnText: { fontSize: 15, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.md },
  cancelBtnText: { fontSize: 14, fontWeight: '700' },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
    marginBottom: Spacing.sm,
  },
  themeOptionText: { flex: 1, gap: 1 },
  themeOptionLabel: { fontSize: 15, fontWeight: '800' },
  themeOptionDesc: { fontSize: 12, fontWeight: '600' },
});
