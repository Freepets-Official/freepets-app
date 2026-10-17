import { BlurView } from 'expo-blur';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Radius, Type } from '@/constants/theme';
import { Text } from '@/components/text';
import { useColorScheme, usePalette } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';

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
      collapsed.set(withTiming(1, { duration: 320 }));
    }, IDLE_MS);
  }, [collapsed]);

  const wake = useCallback(() => {
    collapsed.set(withTiming(0, { duration: 220 }));
    scheduleCollapse();
  }, [collapsed, scheduleCollapse]);

  const onScroll = useCallback(() => {
    // 스크롤하면 즉시 작아지고, 다시 커지는 건 탭 바를 건드릴 때만
    collapsed.set(withTiming(1, { duration: 260 }));
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
  const reduce = useReducedMotion();

  /**
   * 고른 탭 뒤에 말랑한 알약이 미끄러져 따라간다. 화면 안에서 자리를 옮기는 움직임이라
   * 가속·감속이 다 있는 곡선(ease-in-out)을 쓴다. 탭 화면 전환 자체는 여전히 애니메이션 없이 즉시다.
   */
  const [barW, setBarW] = useState(0);
  const count = state.routes.length;
  const itemW = count ? (barW - 12) / count : 0;
  const pill = useSharedValue(state.index);
  useEffect(() => {
    pill.set(reduce ? state.index : withTiming(state.index, { duration: 300, easing: Easing.bezier(0.77, 0, 0.175, 1) }));
  }, [state.index, reduce, pill]);
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pill.value * itemW }] }));

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
            // 다크는 배경(#15110E)보다 더 가라앉힌다. 바탕이 어두울수록 살구색
            // 활성 탭이 또렷해지고, 비활성 회색도 대비를 얻는다.
            backgroundColor: scheme === 'dark' ? 'rgba(13,10,8,0.88)' : 'rgba(255,255,255,0.72)',
          },
        ]}
        onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
        {itemW > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.pill, { width: itemW, backgroundColor: p.accentSoft }, pillStyle]}
          />
        ) : null}
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
            if (!focused && !event.defaultPrevented) {
              haptic.light();
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.item}
              hitSlop={6}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}>
              <TabIcon focused={focused} reduce={reduce}>
                {icon}
              </TabIcon>
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

/** 새로 고른 탭 아이콘이 통 튀어 오른다 — 눌렀다는 확인. 다른 탭은 가만히 */
function TabIcon({ focused, reduce, children }: { focused: boolean; reduce: boolean; children: ReactNode }) {
  const s = useSharedValue(1);
  const y = useSharedValue(0);
  useEffect(() => {
    if (!focused || reduce) return;
    s.set(withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, { damping: 9, stiffness: 260 })));
    y.set(withSequence(withTiming(2, { duration: 90 }), withSpring(0, { damping: 9, stiffness: 260 })));
  }, [focused, reduce, s, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { scale: s.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  pill: { position: 'absolute', left: 6, top: 6, bottom: 6, borderRadius: Radius.full },
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: Platform.select({ ios: 26, default: 16 }),
    // 움직이는 타일(transform)이 웹에서 새 쌓임 맥락을 만들어 탭 바 위로 올라오는 걸 막는다
    zIndex: 50,
    borderRadius: Radius.full,
    // 웜 블랙의 소프트 섀도우로 떠 있는 유리 느낌
    boxShadow: '0 10px 30px rgba(45, 38, 34, 0.14)',
  },
  bar: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 0 },
  label: { fontSize: Type.micro, fontWeight: '800' },
});
