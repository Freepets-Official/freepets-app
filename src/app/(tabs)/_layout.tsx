import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { GlassTabBar, TabChromeProvider } from '@/components/tab-bar';
import { usePalette } from '@/hooks/use-theme';

export default function TabLayout() {
  const p = usePalette();

  return (
    <TabChromeProvider>
      <Tabs
        tabBar={(props) => <GlassTabBar {...(props as any)} />}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: p.accent,
          tabBarInactiveTintColor: p.muted,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: '홈',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: '탐색',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'compass' : 'compass-outline'} size={22} color={color} />
            ),
          }}
        />
        {/* 랭킹은 탐색 탭에 토글로 흡수됨 — 탭바에서만 숨긴다(라우트는 유지).
            탭을 다시 분리하려면 href: null 한 줄만 지우면 된다. */}
        <Tabs.Screen
          name="ranking"
          options={{
            href: null,
            title: '랭킹',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="pets"
          options={{
            title: '반려동물',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'paw' : 'paw-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: '설정',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'settings' : 'settings-outline'} size={22} color={color} />
            ),
          }}
        />
      </Tabs>
    </TabChromeProvider>
  );
}
