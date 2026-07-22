import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import { AppSplash } from '@/components/app-splash';
import { Palette } from '@/constants/theme';
import { AppStoreProvider } from '@/store/app-store';

export default function RootLayout() {
  // 앱은 라이트 테마 고정 — 항상 화이트 배경
  const p = Palette.light;
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
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerStyle: { backgroundColor: p.bg },
            headerTintColor: p.accent,
            contentStyle: { backgroundColor: p.bg },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
        <StatusBar style="dark" />
        {!splashDone && <AppSplash onDone={() => setSplashDone(true)} />}
      </AppStoreProvider>
    </ThemeProvider>
  );
}
