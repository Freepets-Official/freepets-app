import { useRef, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { useScrollToTop } from 'expo-router';

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
  /**
   * 네비게이션 헤더가 보이는 화면이면 `true`.
   *
   * 헤더가 이미 상단 노치·상태바를 차지하므로, 그 위에 SafeArea의 top inset을 또 주면
   * 여백이 두 번 들어가 화면이 아래로 밀린다. 탭 화면은 헤더가 없어 기본값(false)이 맞다.
   */
  hasNavHeader?: boolean;
}

export function Screen({
  children,
  title,
  eyebrow,
  subtitle,
  headerRight,
  onRefresh,
  hasNavHeader = false,
}: ScreenProps) {
  const p = usePalette();
  const chrome = useTabChrome();

  /**
   * 이미 열려 있는 탭을 다시 누르면 맨 위로 올린다(SNS·유튜브에서 익숙한 동작).
   *
   * 커스텀 탭바가 `tabPress`를 emit하고 있어 이 훅이 그걸 받는다. 탭이 아닌 화면
   * (시설 상세·리뷰·제보)에서는 들을 이벤트가 없어 아무 일도 하지 않는다.
   */
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
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
    <SafeAreaView
      edges={hasNavHeader ? ['bottom'] : ['top']}
      style={[styles.safe, { backgroundColor: p.bg }]}>
      {onRefresh && (pull > 0 || refreshing) ? (
        <View style={styles.pullArea}>
          <PullPaws progress={pull / PULL_THRESHOLD} refreshing={refreshing} />
        </View>
      ) : null}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        /**
         * 키보드가 올라오면 그만큼 스크롤 여백을 자동으로 준다.
         *
         * 없으면 화면 아래쪽 입력칸이 키보드에 가린 채 남는다 — 사용자가 지금 뭘 치고
         * 있는지 안 보인다. `KeyboardAvoidingView`로 감싸는 방법도 있지만 그건 화면 전체를
         * 밀어올려서 헤더까지 따라 올라가고, 스크롤 위치와 어긋나기 쉽다.
         */
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
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
  title: { fontSize: 30, lineHeight: 40, fontWeight: '900', letterSpacing: -1 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 2 },
});
