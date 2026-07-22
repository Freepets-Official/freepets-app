import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { EvidencePicker, type Evidence } from '@/components/evidence-picker';
import { Screen } from '@/components/screen';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { FACILITIES } from '@/data/mock';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore, type ReportType } from '@/store/app-store';

const TYPES: { type: ReportType; title: string; body: string; icon: 'checkmark-circle' | 'close-circle' | 'sync-circle' }[] = [
  {
    type: 'ENTERED',
    title: '실제로는 입장됐어요',
    body: 'AI가 불가·조건부로 안내했지만 문제없이 들어갔어요',
    icon: 'checkmark-circle',
  },
  {
    type: 'DENIED',
    title: '실제로는 거부됐어요',
    body: 'AI가 가능하다고 했는데 현장에서 거절당했어요',
    icon: 'close-circle',
  },
  {
    type: 'CONDITION_CHANGED',
    title: '조건이 바뀌었어요',
    body: '체중 제한이나 요구사항이 안내와 달라요',
    icon: 'sync-circle',
  },
];

export default function ReportScreen() {
  const p = usePalette();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addReport } = useAppStore();

  const facilityId = Number(id);
  const facility = FACILITIES.find((f) => f.facilityId === facilityId);

  const [type, setType] = useState<ReportType | null>(null);
  const [content, setContent] = useState('');
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  /** 문서 4-1의 가중치 설계와 같은 식 — 사진·AI 검증이 붙을수록 우선 검토된다 */
  const weight = evidence ? (evidence.aiVerified ? 3 : 2) : 1;

  if (!facility) {
    return (
      <Screen>
        <Text style={{ color: p.muted, textAlign: 'center', paddingVertical: 48 }}>
          시설을 찾을 수 없어요.
        </Text>
      </Screen>
    );
  }

  const submit = () => {
    if (!type) return setError('어떤 상황이었는지 골라 주세요');
    if (!content.trim()) return setError('어떤 점이 달랐는지 알려 주세요');
    addReport(facilityId, type, content.trim(), weight, evidence !== null);
    setSent(true);
    setTimeout(() => router.back(), 1600);
  };

  if (sent) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '제보하기' }} />
        <View style={styles.doneWrap}>
          <View style={[styles.doneIcon, { backgroundColor: p.successSoft }]}>
            <Ionicons name="checkmark" size={30} color={p.success} />
          </View>
          <Text style={[styles.doneTitle, { color: p.ink }]}>제보가 접수됐어요</Text>
          <Text style={[styles.doneBody, { color: p.muted }]}>
            {evidence
              ? '사진이 확인되어 우선 검토 대상으로 접수됐어요.\n더 정확한 정보를 만들어 주셔서 고마워요.'
              : '검토 후 시설 정보에 반영됩니다.\n더 정확한 정보를 만들어 주셔서 고마워요.'}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: '제보하기' }} />

      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: p.accent }]}>정보 정정 제보</Text>
        <Text style={[styles.title, { color: p.ink }]}>AI 판별이{'\n'}실제와 달랐나요?</Text>
        <Text style={[styles.sub, { color: p.muted }]}>
          {facility.name}에 대한 제보는 검토 후 다른 사용자에게도 반영돼요.
        </Text>
      </View>

      <View style={styles.options}>
        {TYPES.map((t) => {
          const on = type === t.type;
          return (
            <Pressable
              key={t.type}
              onPress={() => setType(t.type)}
              style={[
                styles.option,
                CardShadow,
                {
                  backgroundColor: on ? p.accentSoft : p.card,
                  borderColor: on ? p.accent : p.line,
                },
              ]}>
              <Ionicons name={t.icon} size={22} color={on ? p.accent : p.muted} />
              <View style={styles.optionText}>
                <Text style={[styles.optionTitle, { color: p.ink }]}>{t.title}</Text>
                <Text style={[styles.optionBody, { color: p.muted }]}>{t.body}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.block}>
        <Text style={[styles.blockLabel, { color: p.ink }]}>어떤 점이 달랐나요?</Text>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="예) 15kg 골든리트리버도 야외 테라스는 입장 가능했어요"
          placeholderTextColor={p.muted}
          multiline
          style={[
            styles.textarea,
            { backgroundColor: p.surface, borderColor: p.line, color: p.ink },
          ]}
        />
      </View>

      <View style={styles.block}>
        <Text style={[styles.blockLabel, { color: p.ink }]}>증거 사진 (선택)</Text>
        <EvidencePicker evidence={evidence} onChange={setEvidence} />
      </View>

      {weight > 1 && (
        <View style={[styles.weightNote, { backgroundColor: p.accentSoft }]}>
          <Ionicons name="trending-up" size={14} color={p.accent} />
          <Text style={[styles.weightText, { color: p.ink }]}>
            사진이 첨부되어 우선 검토 대상으로 접수돼요
          </Text>
        </View>
      )}

      {error && <Text style={[styles.error, { color: p.danger }]}>{error}</Text>}

      <Pressable
        onPress={submit}
        style={({ pressed }) => [
          styles.submit,
          { backgroundColor: pressed ? p.accentDark : p.accent },
        ]}>
        <Ionicons name="send" size={16} color={p.onAccent} />
        <Text style={[styles.submitLabel, { color: p.onAccent }]}>제보 보내기</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 4, paddingTop: Spacing.sm },
  eyebrow: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase' },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -1, lineHeight: 34 },
  sub: { fontSize: 13.5, lineHeight: 20, marginTop: 4 },
  options: { gap: Spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 14.5, fontWeight: '800' },
  optionBody: { fontSize: 12.5, lineHeight: 18 },
  block: { gap: 8 },
  blockLabel: { fontSize: 15, fontWeight: '800' },
  textarea: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    fontSize: 14.5,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  error: { fontSize: 13, fontWeight: '700' },
  weightNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  weightText: { fontSize: 12.5, fontWeight: '700', flexShrink: 1 },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radius.full,
    paddingVertical: 16,
  },
  submitLabel: { fontSize: 15.5, fontWeight: '800' },
  doneWrap: { alignItems: 'center', gap: Spacing.md, paddingVertical: 80 },
  doneIcon: {
    width: 68,
    height: 68,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: { fontSize: 19, fontWeight: '900', letterSpacing: -0.5 },
  doneBody: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
});
