import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/text';
import { EvidencePicker, type Evidence } from '@/components/evidence-picker';
import { Screen } from '@/components/screen';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { FACILITIES, isMockFacilityId } from '@/data/mock';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore, type ReportType } from '@/store/app-store';
import { ApiError, denialApi, type DenialReasonCode } from '@/lib/api';

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
  const { addReport, facilityById, loadFacility } = useAppStore();

  const facilityId = Number(id);
  // 목 데이터에만 기대면 관광공사에서 온 실제 시설은 "찾을 수 없어요"가 뜬다
  const facility = facilityById(facilityId) ?? FACILITIES.find((f) => f.facilityId === facilityId);

  useEffect(() => {
    if (Number.isInteger(facilityId) && facilityId > 0) loadFacility(facilityId);
  }, [facilityId, loadFacility]);

  const [type, setType] = useState<ReportType | null>(null);
  const [content, setContent] = useState('');
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  /** 문서 4-1의 가중치 설계와 같은 식 — 사진·AI 검증이 붙을수록 우선 검토된다 */
  const weight = evidence ? (evidence.aiVerified ? 3 : 2) : 1;

  if (!facility) {
    return (
      <Screen hasNavHeader>
        <Text style={{ color: p.muted, textAlign: 'center', paddingVertical: 48 }}>
          시설을 찾을 수 없어요.
        </Text>
      </Screen>
    );
  }

  /**
   * 제보 종류를 서버 거부 사유로 옮긴다.
   *
   * ⚠️ **`ENTERED`는 넣지 않는다.** "실제로는 들어갔다"는 거부의 반대인데, 거부 제보로
   * 보내면 다른 사용자에게 **없던 경고가 뜬다.** 서버에 긍정 제보를 받는 자리가 없어
   * 이 종류는 이 기기에만 남긴다.
   *
   * 거부는 `OTHER`로 보낸다. 이 화면은 사유를 고르게 하지 않고 서술로 받기 때문이다
   * (사유를 고르는 건 시설 상세의 원터치 제보 쪽이다).
   */
  const REASON_BY_TYPE: Partial<Record<ReportType, DenialReasonCode>> = {
    DENIED: 'OTHER',
    CONDITION_CHANGED: 'POLICY_CHANGED',
  };

  const submit = async () => {
    if (!type) return setError('어떤 상황이었는지 골라 주세요');
    if (!content.trim()) return setError('어떤 점이 달랐는지 알려 주세요');

    setSending(true);
    setError(null);
    try {
      const reason = REASON_BY_TYPE[type];
      // 서버는 사유만 저장한다(서술·사진은 아직 받는 자리가 없다). 목 시설은 서버에 없다.
      if (reason && !isMockFacilityId(facilityId)) {
        await denialApi.report(facilityId, reason);
      }
    } catch (e) {
      // 24시간 안에 이미 보냈다는 뜻이라 실패가 아니다. 그 외 오류는 알리고 멈춘다.
      const dup = e instanceof ApiError && e.code === 'REPORT4001';
      if (!dup) {
        setSending(false);
        setError(e instanceof Error ? e.message : '제보를 보내지 못했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
    }

    // 서술·사진은 서버가 받지 않으므로 이 기기에 남겨 내 제보 목록에 보여준다
    addReport(facilityId, type, content.trim(), weight, evidence !== null);
    setSending(false);
    setSent(true);
    setTimeout(() => router.back(), 1600);
  };

  if (sent) {
    return (
      <Screen hasNavHeader>
        <Stack.Screen options={{ title: '제보하기', headerBackButtonDisplayMode: 'minimal'}} />
        <View style={styles.doneWrap}>
          <View style={[styles.doneIcon, { backgroundColor: p.successSoft }]}>
            <Ionicons name="checkmark" size={30} color={p.success} />
          </View>
          <Text style={[styles.doneTitle, { color: p.ink }]}>
            {type === 'ENTERED' ? '알려주셔서 고마워요' : '제보가 접수됐어요'}
          </Text>
          <Text style={[styles.doneBody, { color: p.muted }]}>
            {/*
              사진·서술은 서버가 아직 받는 자리가 없어 이 기기에 남는다. "우선 검토 대상"처럼
              심사 절차가 도는 것처럼 말하지 않는다 — 실제로 도는 건 거부 사유 접수뿐이다.
            */}
            {type === 'ENTERED'
              ? '들어가셨다니 다행이에요.\n남겨주신 내용은 다음 판별을 다듬는 데 씁니다.'
              : '같은 곳을 보려는 다른 집사에게 경고로 전해져요.\n더 정확한 정보를 만들어 주셔서 고마워요.'}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen hasNavHeader>
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
        disabled={sending}
        style={({ pressed }) => [
          styles.submit,
          { backgroundColor: pressed ? p.accentDark : p.accent },
        ]}>
        <Ionicons name="send" size={16} color={p.onAccent} />
        <Text style={[styles.submitLabel, { color: p.onAccent }]}>
          {sending ? '보내는 중…' : '제보 보내기'}
        </Text>
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
