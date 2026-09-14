import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/text';
import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';
import { ApiError, businessApi, type BusinessIdentity } from '@/lib/api';

/** 사업자등록번호 10자리만 남긴다 */
export const bizDigitsOnly = (s: string) => s.replace(/[^0-9]/g, '').slice(0, 10);
export const formatBizNo = (d: string) =>
  d.length <= 3 ? d : d.length <= 5 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
/** 앞 5자리만 보이고 뒤는 가린다 — 화면·로컬에는 이것만 남긴다 */
export const maskBizNo = (d: string) => `${d.slice(0, 3)}-${d.slice(3, 5)}-*****`;

const dateDigitsOnly = (s: string) => s.replace(/[^0-9]/g, '').slice(0, 8);
const formatDate8 = (d: string) =>
  d.length <= 4 ? d : d.length <= 6 ? `${d.slice(0, 4)}.${d.slice(4)}` : `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;

/** YYYYMMDD가 실제 날짜인지. 서버는 자릿수만 보므로 20261340 같은 값은 여기서 걸러야 한다 */
function isValidDate8(d: string) {
  if (d.length !== 8) return false;
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(4, 6));
  const day = Number(d.slice(6, 8));
  const dt = new Date(Date.UTC(y, m - 1, day));
  return (
    y >= 1900 &&
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === day &&
    dt.getTime() <= Date.now()
  );
}

/**
 * 사업자 진위확인 — 국세청 사업자등록정보(`POST /business/verify`).
 *
 * 번호만으로는 확인이 안 된다. 국세청 진위확인은 **번호·대표자명·개업일 세 가지가 모두
 * 일치**해야 응답하므로 셋을 같이 받는다. 확인된 값은 매장 조건을 확정할 때 다시 보내야
 * 해서(claim이 세션이 아니라 요청마다 사업자 정보를 받는다) 그대로 부모에게 넘긴다.
 *
 * 예전에는 900ms 기다렸다가 무조건 통과시키는 데모였다.
 */
export function BusinessVerify({
  onVerified,
}: {
  onVerified: (identity: BusinessIdentity, masked: string) => void;
}) {
  const p = usePalette();
  const [bizDigits, setBizDigits] = useState('');
  const [rep, setRep] = useState('');
  const [date, setDate] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async () => {
    if (verifying) return;
    if (bizDigits.length !== 10) return setError('사업자등록번호 10자리를 정확히 입력해 주세요');
    if (!rep.trim()) return setError('대표자 성명을 입력해 주세요');
    if (!isValidDate8(date)) return setError('개업일을 YYYYMMDD 8자리로 입력해 주세요 (예: 20230115)');
    setError(null);
    setVerifying(true);
    const identity: BusinessIdentity = {
      businessNumber: bizDigits,
      representativeName: rep.trim(),
      openingDate: date,
    };
    try {
      const r = await businessApi.verify(identity);
      if (!r.valid) {
        // 휴업·폐업·불일치 — 서버가 준 상태 그대로 보여준다. 여기서 뭉뚱그리면 뭘 고칠지 모른다
        setError(`확인되지 않았어요 · ${r.statusLabel}. 사업자등록증의 번호·대표자명·개업일과 같은지 봐주세요.`);
        return;
      }
      onVerified(identity, maskBizNo(bizDigits));
    } catch (e) {
      setError(
        e instanceof ApiError && e.message
          ? e.message
          : '진위확인 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setVerifying(false);
    }
  };

  const border = (bad: boolean) => ({ backgroundColor: p.surface, borderColor: bad ? p.danger : p.line });

  return (
    <View style={styles.wrap}>
      <View style={[styles.inputRow, border(!!error && bizDigits.length !== 10)]}>
        <Ionicons name="business" size={17} color={p.muted} />
        <TextInput
          value={formatBizNo(bizDigits)}
          onChangeText={(t) => setBizDigits(bizDigitsOnly(t))}
          placeholder="사업자등록번호 (숫자 10자리)"
          placeholderTextColor={p.muted}
          keyboardType="number-pad"
          style={[styles.input, { color: p.ink }]}
        />
      </View>
      <View style={[styles.inputRow, border(!!error && !rep.trim())]}>
        <Ionicons name="person" size={17} color={p.muted} />
        <TextInput
          value={rep}
          onChangeText={setRep}
          placeholder="대표자 성명 (사업자등록증 기준)"
          placeholderTextColor={p.muted}
          autoCapitalize="none"
          style={[styles.input, { color: p.ink }]}
        />
      </View>
      <View style={[styles.inputRow, border(!!error && !isValidDate8(date))]}>
        <Ionicons name="calendar" size={17} color={p.muted} />
        <TextInput
          value={formatDate8(date)}
          onChangeText={(t) => setDate(dateDigitsOnly(t))}
          placeholder="개업일 (YYYYMMDD)"
          placeholderTextColor={p.muted}
          keyboardType="number-pad"
          style={[styles.input, { color: p.ink }]}
        />
      </View>

      {error && <Text style={[styles.err, { color: p.danger }]}>{error}</Text>}

      <Pressable
        onPress={() => void verify()}
        disabled={verifying}
        style={({ pressed }) => [
          styles.actionBtn,
          { backgroundColor: pressed || verifying ? p.accentDark : p.accent },
        ]}>
        {verifying ? (
          <>
            <ActivityIndicator color={p.onAccent} size="small" />
            <Text style={[styles.actionBtnText, { color: p.onAccent }]}>국세청에 확인 중…</Text>
          </>
        ) : (
          <Text style={[styles.actionBtnText, { color: p.onAccent }]}>진위확인</Text>
        )}
      </Pressable>
      <Text style={[styles.hint, { color: p.muted }]}>
        국세청 사업자등록정보로 진위만 확인해요. 세 가지가 모두 일치해야 통과하고, 번호 원본은 기기에
        저장하지 않아요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
  },
  input: { flex: 1, fontSize: 15, padding: 0 },
  err: { fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radius.full,
    paddingVertical: 15,
    marginTop: 2,
  },
  actionBtnText: { fontSize: 15, fontWeight: '800' },
  hint: { fontSize: 12, lineHeight: 17 },
});
