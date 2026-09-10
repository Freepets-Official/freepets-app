import { BlurView } from 'expo-blur';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Text } from '@/components/text';
import { useColorScheme, usePalette } from '@/hooks/use-theme';

/**
 * 인스타그램식 유리 네비게이터 + 자동 축소.
 * - 화면을 3초 이상 가만히 두거나 스크롤하면 잠깐 작아진다(collapsed → 1).
 * - 탭 바에 손이 닿으려 하면(터치·호버) 원래 크기로 돌아온다(collapsed → 0).
 */
interface TabChrome {
  collapsed: SharedValue<number>;
  wake: () => void;
  onScroll: () => void;
}

const TabChromeContext = createContext<TabChrome | null>(null);
export const useTabChrome = () => useContext(TabChromeContext);

const IDLE_MS = 3000;

export function TabChromeProvider({ children }: { children: ReactNode }) {
  const collapsed = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleCollapse = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      collapsed.value = withTiming(1, { duration: 320 });
    }, IDLE_MS);
  }, [collapsed]);

  const wake = useCallback(() => {
    collapsed.value = withTiming(0, { duration: 220 });
    scheduleCollapse();
  }, [collapsed, scheduleCollapse]);

  const onScroll = useCallback(() => {
    // 스크롤하면 즉시 작아지고, 다시 커지는 건 탭 바를 건드릴 때만
    collapsed.value = withTiming(1, { duration: 260 });
    if (timer.current) clearTimeout(timer.current);
  }, [collapsed]);

  useEffect(() => {
    scheduleCollapse();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [scheduleCollapse]);

  return (
    <TabChromeContext.Provider value={{ collapsed, wake, onScroll }}>
      {children}
    </TabChromeContext.Provider>
  );
}

interface TabRoute {
  key: string;
  name: string;
}
interface TabBarProps {
  state: { index: number; routes: TabRoute[] };
  descriptors: Record<string, { options: any }>;
  navigation: {
    emit: (e: any) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

export function GlassTabBar(props: TabBarProps) {
  const { state, descriptors, navigation } = props;
  // 예전에는 `Palette.light`를 박아 써서 탭바만 테마를 안 따랐다. 다크에서 밝은 유리 위에
  // 밝은 회색 글씨가 얹혀 아무것도 안 보였다.
  const p = usePalette();
  const scheme = useColorScheme();
  const chrome = useTabChrome();
  const collapsed = chrome?.collapsed;

  const barStyle = useAnimatedStyle(() => {
    const c = collapsed?.value ?? 0;
    return {
      transform: [{ scale: 1 - c * 0.16 }, { translateY: c * 10 }],
      opacity: 1 - c * 0.15,
    };
  });

  const labelStyle = useAnimatedStyle(() => {
    const c = collapsed?.value ?? 0;
    return { opacity: 1 - c, height: (1 - c) * 13, marginTop: (1 - c) * 3 };
  });

  return (
    <Animated.View
      style={[styles.wrap, barStyle]}
      onTouchStart={() => chrome?.wake()}
      // @ts-expect-error web 전용 호버 — 데스크톱에서 손이 닿기 전 확대
      onMouseEnter={Platform.OS === 'web' ? () => chrome?.wake() : undefined}>
      {/*
        유리 톤을 테마에 맞춘다. 예전에는 항상 밝은 유리였는데, 다크에서는 글씨 색이
        밝은 회색(`muted`)이라 밝은 배경 위에서 대비가 사라져 **탭이 아예 안 보였다.**
        폴백 배경색도 같은 이유로 갈라준다 — BlurView가 안 도는 환경에서 흰 판이 남는다.
      */}
      <BlurView
        intensity={60}
        tint={scheme === 'dark' ? 'dark' : 'light'}
        style={[
          styles.bar,
          {
            borderColor: p.line,
            backgroundColor: scheme === 'dark' ? 'rgba(33,28,40,0.72)' : 'rgba(255,255,255,0.72)',
          },
        ]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const color = focused ? p.accent : p.muted;
          const icon = options.tabBarIcon?.({ focused, color, size: 22 });
          const label =
            typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name;

          const onPress = () => {
            chrome?.wake();
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <Pressable key={route.key} onPress={onPress} style={styles.item} hitSlop={6}>
              {icon}
              <Animated.View style={labelStyle}>
                <Text style={[styles.label, { color }]} numberOfLines={1}>
                  {label}
                </Text>
              </Animated.View>
            </Pressable>
          );
        })}
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: Platform.select({ ios: 26, default: 16 }),
    borderRadius: 999,
    // 핑크 기운의 소프트 섀도우로 떠 있는 유리 느낌
    boxShadow: '0 10px 30px rgba(42, 37, 48, 0.14)',
  },
  bar: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 0 },
  label: { fontSize: 10, fontWeight: '800' },
});
