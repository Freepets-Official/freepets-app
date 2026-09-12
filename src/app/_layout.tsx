import { DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { Platform, Pressable } from 'react-native';

import { AppSplash } from '@/components/app-splash';
import { BiometricGate } from '@/components/biometric-gate';
import { CallConfirmSheet } from '@/components/call-confirm-sheet';
import { PawTouches } from '@/components/paw-touches';
import { AppThemeProvider, usePalette, useColorScheme } from '@/hooks/use-theme';
import { FontScaleProvider } from '@/components/text';
import { onNotificationTap } from '@/lib/push';
import { AppStoreProvider, useAppStore } from '@/store/app-store';

/**
 * 인증·프로필 게이트. 세션 상태에 따라 진입 화면을 강제한다.
 * - 비로그인 → 로그인
 * - 로그인했지만 프로필 미선택(사업자 프로필이 있어 골라야 함) → 프로필 선택
 * - 프로필 선택 완료 → 해당 프로필 홈(일반=탭, 사업자=대시보드)
 * 그 외 임의 화면(시설 상세 등)으로의 이동은 막지 않는다.
 */
function useAuthGate() {
  const { session, restoring } = useAppStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // 저장된 세션을 확인하는 동안은 아무 데로도 보내지 않는다. 여기서 판단하면
    // 이미 로그인된 사용자가 로그인 화면을 한 번 스쳐 지나간다.
    if (restoring) return;
    const seg = segments[0];
    const onAuth = seg === 'login' || seg === 'signup';
    const onPicker = seg === 'profile-select';
    /**
     * 약관·개인정보처리방침은 **로그인 없이 읽을 수 있어야 한다.**
     *
     * 앱스토어에 낸 개인정보처리방침 URL이 이 경로(`/policy?tab=privacy`)다. 게이트가
     * 로그인으로 돌려보내면 심사자가 방침을 아예 못 읽는다 — 확정 리젝 사유다.
     * 앱 안에서도 가입 전에 약관을 확인하려는 사람을 막을 이유가 없다.
     */
    const isPublicDoc = seg === 'policy';

    if (!session.authed) {
      if (!onAuth && !isPublicDoc) router.replace('/login');
    } else if (session.activeProfile == null) {
      if (!onPicker) router.replace('/profile-select');
    } else if (onAuth || onPicker) {
      router.replace(session.activeProfile === 'owner' ? '/owner-dashboard' : '/');
    }
  }, [restoring, session.authed, session.activeProfile, segments, router]);
}

/**
 * 알림을 탭하면 그 시설 상세로 보낸다.
 *
 * 서버는 data payload에 `facilityId`만 싣는다. 로그인 전에는 보내지 않는다 —
 * 인증 게이트가 곧바로 로그인 화면으로 되돌려 이동이 헛돌기 때문이다.
 */
function usePushDeepLink() {
  const router = useRouter();
  const { session } = useAppStore();

  useEffect(() => {
    if (!session.authed) return;
    return onNotificationTap((data) => {
      const id = Number(data.facilityId);
      // 서버가 문자열로 보내므로 숫자로 바꾼다. 값이 깨졌으면 아무 데도 보내지 않는다.
      if (Number.isFinite(id) && id > 0) {
        router.push({ pathname: '/facility/[id]', params: { id: String(id) } });
      }
    });
  }, [session.authed, router]);
}

/**
 * 히스토리가 없을 때 세우는 뒤로가기.
 *
 * 웹은 SPA라 `/course` 같은 주소가 그대로 열린다(vercel.json이 전부 index.html로 넘긴다).
 * 주소로 바로 들어오거나 브라우저가 탭을 다시 읽으면 앞선 화면이 없어서, 네이티브 스택이
 * 뒤로가기 버튼을 아예 그리지 않는다 — 화면은 그대로인데 나갈 길만 사라진다.
 * 모바일 크롬은 메모리가 모자라면 탭을 다시 읽으므로 "가끔" 이 상태가 된다.
 *
 * 그때는 홈으로 보내는 버튼을 대신 세운다. 돌아갈 데가 있는 보통 상황에서는 이 버튼이
 * 붙지 않아 네이티브 기본 뒤로가기가 그대로 쓰인다.
 */
function HomeFallbackBack() {
  const p = usePalette();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.replace('/')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="홈으로"
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingRight: 8 })}>
      <Ionicons name="chevron-back" size={26} color={p.accent} />
    </Pressable>
  );
}

function RootNavigator() {
  useAuthGate();
  usePushDeepLink();
  const p = usePalette();
  return (
    <Stack
      screenOptions={({ navigation }) => ({
        headerLeft: navigation.canGoBack() ? undefined : () => <HomeFallbackBack />,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: p.bg },
        headerTintColor: p.accent,
        headerTitleStyle: { color: p.ink },
        contentStyle: { backgroundColor: p.bg },
        /**
         * 스택 진입 기본 전환 — 플랫폼 기본을 쓴다.
         *
         * `slide_from_right`는 새 화면이 통째로 미끄러져 들어오는 방식이라 뻣뻣하다.
         * `default`는 iOS에서 UINavigationController의 push가 그대로 나와서, 이전 화면이
         * 살짝 따라 움직이는 패럴랙스와 가장자리 그림자가 붙는다 — 훨씬 부드럽다.
         * 가장자리 스와이프로 뒤로 가는 제스처도 이쪽이 자연스럽다.
         */
        animation: 'default',
        gestureEnabled: true,
      })}>
      {/* 인증 게이트 화면은 replace로 갈아끼우므로 슬라이드보다 페이드가 자연스럽다 */}
      <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="signup" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="profile-select" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="owner-dashboard" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
      {/*
        입력·정보 화면도 나머지와 같은 전환을 쓴다. 예전에는 아래에서 올라오게 뒀는데,
        같은 깊이의 화면인데 어떤 건 옆에서 어떤 건 아래에서 와서 흐름이 끊겼다.
        모달은 "지금 이걸 끝내야 돌아간다"는 뜻인데, 이 화면들은 그냥 다음 단계다.
      */}
      <Stack.Screen
        name="calendar-event"
        options={{ title: '일정 추가', headerBackButtonDisplayMode: 'minimal' }}
      />
      <Stack.Screen
        name="policy"
        options={{ title: '약관·정책', headerBackButtonDisplayMode: 'minimal' }}
      />
      <Stack.Screen
        name="notices"
        options={{ title: '공지사항', headerBackButtonDisplayMode: 'minimal' }}
      />
      <Stack.Screen
        name="profile-edit"
        options={{ title: '프로필 관리', headerBackButtonDisplayMode: 'minimal' }}
      />
      <Stack.Screen
        name="course"
        options={{ title: '여행 코스', headerBackButtonDisplayMode: 'minimal' }}
      />
      <Stack.Screen
        name="business"
        options={{ title: '사업자 등록', headerBackButtonDisplayMode: 'minimal' }}
      />
      <Stack.Screen
        name="restaurant"
        options={{ title: '동반 음식점 등록', headerBackButtonDisplayMode: 'minimal' }}
      />
      <Stack.Screen
        name="facility/[id]"
        options={{ title: '', headerBackButtonDisplayMode: 'minimal' }}
      />
      <Stack.Screen
        name="review/[id]"
        options={{ title: '리뷰 쓰기', headerBackButtonDisplayMode: 'minimal' }}
      />
      <Stack.Screen
        name="report/[id]"
        options={{ title: '제보하기', headerBackButtonDisplayMode: 'minimal' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  // 화면 모드는 스토어에 있고, 실제 스킴 전환(자동 경계·포그라운드 재계산)은
  // AppThemeProvider가 관리한다. 두 프로바이더 안에서 테마를 읽는다.
  return (
    // 제스처(스와이프 삭제 등)가 동작하려면 트리 최상단을 이걸로 감싸야 한다.
    // expo-router가 자동으로 넣어주지 않아 여기서 직접 건다.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppStoreProvider>
        <AppThemeProvider>
          <ScaledTextRoot />
        </AppThemeProvider>
      </AppStoreProvider>
    </GestureHandlerRootView>
  );
}

/**
 * 글씨 크기 배율을 트리 전체에 내린다.
 *
 * 스토어 안쪽에 둬야 설정을 읽을 수 있고, 화면보다 바깥에 둬야 모든 텍스트가 덮인다.
 * 배율만 담은 컨텍스트라 설정이 실제로 바뀔 때만 아래가 다시 그려진다.
 */
function ScaledTextRoot() {
  const { settings } = useAppStore();
  return (
    <FontScaleProvider mode={settings.fontSize}>
      <ThemedRoot />
    </FontScaleProvider>
  );
}

function ThemedRoot() {
  const [splashDone, setSplashDone] = useState(false);
  const p = usePalette();
  const scheme = useColorScheme();

  // 웹: 콘텐츠 밖(오버스크롤·여백)에 화이트가 비치지 않도록 body 배경을 맞춘다.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.style.backgroundColor = p.bg;
    }
  }, [p.bg]);

  const navTheme = {
    ...DefaultTheme,
    dark: scheme === 'dark',
    colors: {
      ...DefaultTheme.colors,
      background: p.bg,
      card: p.bg,
      text: p.ink,
      border: p.line,
      primary: p.accent,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <BiometricGate>
        <PawTouches>
          <RootNavigator />
        </PawTouches>
      </BiometricGate>
      {/* 전화 후 "확인하셨나요"는 앱 전체에서 한 곳에서만 묻는다 — 전화 버튼이 여러 화면에 있어도
          신뢰도 갱신 규칙이 갈리지 않게 하려는 것이다 */}
      <CallConfirmSheet />
      {/* 다크에선 밝은 글씨의 상태바 */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {!splashDone && <AppSplash onDone={() => setSplashDone(true)} />}
    </ThemeProvider>
  );
}
