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
        <Tabs.Screen
          name="ranking"
          options={{
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
