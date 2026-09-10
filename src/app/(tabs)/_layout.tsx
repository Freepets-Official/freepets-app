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
          /**
           * 탭 전환에 애니메이션을 걸지 않는다.
           *
           * 부드러우라고 `fade`를 넣었더니 **전환이 눈에 띄게 느려지고 화면이 아예 안 뜨는
           * 경우까지 생겼다.** 페이드는 두 화면을 겹쳐 그리는데, 탐색처럼 목록이 무거운
           * 탭에서는 그 한 프레임이 길어진다. 즉시 전환이 덜 예쁘지만 확실히 빠르다.
           */
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
        {/* 랭킹은 탐색 탭 토글(RankingView)로 완전히 흡수됨 — 별도 탭 라우트 없음.
            다시 분리하려면 (tabs)/ranking.tsx를 <Screen><RankingView/></Screen>로 되살리면 된다. */}
        <Tabs.Screen
          name="calendar"
          options={{
            title: '캘린더',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={22} color={color} />
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
