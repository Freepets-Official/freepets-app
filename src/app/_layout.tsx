import { DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { AppSplash } from '@/components/app-splash';
import { Palette } from '@/constants/theme';
import { AppStoreProvider, useAppStore } from '@/store/app-store';

// 앱은 라이트 테마 고정 — 항상 화이트 배경
const p = Palette.light;

/**
 * 인증·프로필 게이트. 세션 상태에 따라 진입 화면을 강제한다.
 * - 비로그인 → 로그인
 * - 로그인했지만 프로필 미선택(사업자 프로필이 있어 골라야 함) → 프로필 선택
 * - 프로필 선택 완료 → 해당 프로필 홈(일반=탭, 사업자=대시보드)
 * 그 외 임의 화면(시설 상세 등)으로의 이동은 막지 않는다.
 */
function useAuthGate() {
  const { session } = useAppStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const seg = segments[0];
    const onAuth = seg === 'login' || seg === 'signup';
    const onPicker = seg === 'profile-select';

    if (!session.authed) {
      if (!onAuth) router.replace('/login');
    } else if (session.activeProfile == null) {
      if (!onPicker) router.replace('/profile-select');
    } else if (onAuth || onPicker) {
      router.replace(session.activeProfile === 'owner' ? '/owner-dashboard' : '/');
    }
  }, [session.authed, session.activeProfile, segments, router]);
}

function RootNavigator() {
  useAuthGate();
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: p.bg },
        headerTintColor: p.accent,
        contentStyle: { backgroundColor: p.bg },
        // 스택 진입 기본 전환 — iOS식 오른쪽 슬라이드(뒤로가기 제스처 포함)
        animation: 'slide_from_right',
      }}>
      {/* 인증 게이트 화면은 replace로 갈아끼우므로 슬라이드보다 페이드가 자연스럽다 */}
      <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="signup" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="profile-select" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="owner-dashboard" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
      {/* 입력·정보 화면은 아래에서 올라오는 모달 느낌 */}
      <Stack.Screen
        name="calendar-event"
        options={{ title: '일정 추가', headerBackButtonDisplayMode: 'minimal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="policy"
        options={{ title: '약관·정책', headerBackButtonDisplayMode: 'minimal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="notices"
        options={{ title: '공지사항', headerBackButtonDisplayMode: 'minimal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="profile-edit"
        options={{ title: '프로필 관리', headerBackButtonDisplayMode: 'minimal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="course"
        options={{ title: '여행 코스', headerBackButtonDisplayMode: 'minimal' }}
      />
      <Stack.Screen
        name="business"
        options={{ title: '사업자 등록', headerBackButtonDisplayMode: 'minimal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="restaurant"
        options={{ title: '동반 음식점 등록', headerBackButtonDisplayMode: 'minimal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="facility/[id]"
        options={{ title: '', headerBackButtonDisplayMode: 'minimal' }}
      />
      <Stack.Screen
        name="review/[id]"
        options={{ title: '리뷰 쓰기', headerBackButtonDisplayMode: 'minimal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="report/[id]"
        options={{ title: '제보하기', headerBackButtonDisplayMode: 'minimal', animation: 'slide_from_bottom' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);

  const navTheme = {
    ...DefaultTheme,
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
      <AppStoreProvider>
        <RootNavigator />
        <StatusBar style="dark" />
        {!splashDone && <AppSplash onDone={() => setSplashDone(true)} />}
      </AppStoreProvider>
    </ThemeProvider>
  );
}
