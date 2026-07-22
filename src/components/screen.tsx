import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTabChrome } from '@/components/tab-bar';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';

interface ScreenProps {
  children: ReactNode;
  /** 화면 대제목 — 랜딩과 같은 굵은 타이포 위계 */
  title?: string;
  eyebrow?: string;
  subtitle?: string;
}

export function Screen({ children, title, eyebrow, subtitle }: ScreenProps) {
  const p = usePalette();
  const chrome = useTabChrome();
  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={64}
        onScroll={chrome ? () => chrome.onScroll() : undefined}
        keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          {(title || eyebrow) && (
            <View style={styles.header}>
              {eyebrow ? <Text style={[styles.eyebrow, { color: p.accent }]}>{eyebrow}</Text> : null}
              {title ? <Text style={[styles.title, { color: p.ink }]}>{title}</Text> : null}
              {subtitle ? <Text style={[styles.subtitle, { color: p.muted }]}>{subtitle}</Text> : null}
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
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 104 },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.lg,
  },
  header: { gap: 4, paddingTop: Spacing.xl, paddingBottom: Spacing.xs },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: { fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 2 },
});
