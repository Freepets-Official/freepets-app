import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PullPaws } from '@/components/pull-paws';
import { useTabChrome } from '@/components/tab-bar';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';

const PULL_THRESHOLD = 64;

interface ScreenProps {
  children: ReactNode;
  /** 화면 대제목 — 랜딩과 같은 굵은 타이포 위계 */
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  /** 헤더 우측 상단 액션(예: 알림 종 버튼) */
  headerRight?: ReactNode;
  /** 넘기면 당겨서 새로고침(발자국) 활성화. 데모는 연출용, 백엔드 연동 시 실 새로고침. */
  onRefresh?: () => void | Promise<void>;
}

export function Screen({ children, title, eyebrow, subtitle, headerRight, onRefresh }: ScreenProps) {
  const p = usePalette();
  const chrome = useTabChrome();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    chrome?.onScroll();
    if (!onRefresh || refreshing) return;
    const y = e.nativeEvent.contentOffset.y;
    const next = y < 0 ? Math.min(-y, PULL_THRESHOLD + 24) : 0;
    setPull((prev) => (prev === next ? prev : next)); // 같은 값이면 리렌더 생략
  };

  const handleEndDrag = () => {
    if (!onRefresh || refreshing) return;
    if (pull >= PULL_THRESHOLD) {
      setRefreshing(true);
      setPull(PULL_THRESHOLD);
      Promise.resolve(onRefresh()).finally(() =>
        setTimeout(() => {
          setRefreshing(false);
          setPull(0);
        }, 700),
      );
    } else {
      setPull(0);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: p.bg }]}>
      {onRefresh && (pull > 0 || refreshing) ? (
        <View style={styles.pullArea}>
          <PullPaws progress={pull / PULL_THRESHOLD} refreshing={refreshing} />
        </View>
      ) : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollEndDrag={handleEndDrag}
        keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          {(title || eyebrow || headerRight) && (
            <View style={styles.header}>
              <View style={styles.headerText}>
                {eyebrow ? <Text style={[styles.eyebrow, { color: p.accent }]}>{eyebrow}</Text> : null}
                {title ? <Text style={[styles.title, { color: p.ink }]}>{title}</Text> : null}
                {subtitle ? <Text style={[styles.subtitle, { color: p.muted }]}>{subtitle}</Text> : null}
              </View>
              {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
            </View>
          )}
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  // 당겨서 새로고침 발자국이 콘텐츠 상단 뒤에서 보이도록
  pullArea: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingTop: Spacing.md, zIndex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 104 },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xs,
  },
  headerText: { flex: 1, gap: 4 },
  headerRight: { paddingTop: 2 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: { fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 2 },
});
