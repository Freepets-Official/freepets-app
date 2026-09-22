import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { CardShadow, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';
import { noticesApi, type Notice } from '@/lib/api';

/** ISO(UTC) → 한국 날짜 YYYY-MM-DD. 서버는 Z로 준다 */
function kstDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}-${String(k.getUTCDate()).padStart(2, '0')}`;
}

/**
 * 공지사항 — `GET /notices`.
 *
 * 1.0에는 하드코딩 4건이 있었고 날짜가 출시 전이라 지어낸 이력처럼 보여 설정에서 가렸다.
 * 이제 서버가 준다. 못 받으면 "불러오지 못했어요"를 말한다 — 빈 화면은 "공지가 없다"로 읽힌다.
 */
export default function NoticesScreen() {
  const p = usePalette();
  const [items, setItems] = useState<Notice[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setItems(await noticesApi.list());
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safe, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ title: '공지사항', headerBackButtonDisplayMode: 'minimal' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          {failed ? (
            <Pressable
              onPress={() => void load()}
              style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: p.line, alignItems: 'center' }]}>
              <Ionicons name="cloud-offline-outline" size={28} color={p.muted} />
              <Text style={[styles.title, { color: p.ink }]}>공지를 불러오지 못했어요</Text>
              <Text style={[styles.body, { color: p.muted }]}>눌러서 다시 시도</Text>
            </Pressable>
          ) : items === null ? (
            <ActivityIndicator color={p.accent} style={{ paddingVertical: 48 }} />
          ) : items.length === 0 ? (
            <Text style={[styles.body, { color: p.muted, textAlign: 'center', paddingVertical: 48 }]}>
              아직 공지가 없어요.
            </Text>
          ) : (
            items.map((n) => (
              <View
                key={n.id}
                style={[styles.card, CardShadow, { backgroundColor: p.card, borderColor: n.pinned ? p.accent : p.line }]}>
                <View style={styles.top}>
                  {n.pinned ? (
                    <View style={[styles.tag, { backgroundColor: p.accentSoft }]}>
                      <Ionicons name="pin" size={11} color={p.accent} />
                      <Text style={[styles.tagText, { color: p.accent }]}>고정</Text>
                    </View>
                  ) : (
                    <View />
                  )}
                  <Text style={[styles.date, { color: p.muted }]}>{kstDate(n.createdAt)}</Text>
                </View>
                <Text style={[styles.title, { color: p.ink }]}>{n.title}</Text>
                <Text style={[styles.body, { color: p.muted }]}>{n.body}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, paddingBottom: 48 },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.md },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontSize: Type.caption, fontWeight: '800' },
  date: { fontSize: Type.caption, fontWeight: '600', fontVariant: ['tabular-nums'] },
  title: { fontSize: Type.callout, fontWeight: '800', letterSpacing: -0.3 },
  body: { fontSize: Type.body, lineHeight: 20 },
});
