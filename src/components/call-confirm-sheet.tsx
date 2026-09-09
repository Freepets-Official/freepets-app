import { useEffect, useRef } from 'react';
import { AppState, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

/**
 * 전화를 걸고 앱으로 돌아왔을 때 "확인했는지" 한 번 묻는다.
 *
 * 왜 필요한가: `Linking.openURL`이 성공했다는 건 다이얼러가 열렸다는 뜻일 뿐이라, 열고 바로
 * 취소해도 성공으로 온다. 그걸 근거로 신뢰도를 '확정 · 내가 전화로 확인'까지 올리면 **확인하지
 * 않은 정보에 확인 도장을 찍는 것**이고, 헛걸음 방지가 목적인 서비스에서 가장 하면 안 되는 일이다.
 *
 * 앱 어디에 전화 버튼이 몇 개 있든 **묻는 곳은 여기 하나뿐이다.** 화면마다 확인 UI를 두면
 * 규칙이 갈리고, 전화 버튼이 늘 때마다 빠뜨리게 된다(실제로 그 문제로 두 버튼의 동작이 달랐다).
 */
export function CallConfirmSheet() {
  const p = usePalette();
  const { pendingCallConfirm, setPendingCallConfirm, confirmFacility } = useAppStore();
  const returned = useRef(false);

  // 전화 앱에 가 있는 동안은 묻지 않는다. 포그라운드로 돌아온 뒤에 띄운다.
  useEffect(() => {
    if (pendingCallConfirm == null) {
      returned.current = false;
      return;
    }
    if (AppState.currentState === 'active') {
      // 웹처럼 앱 전환이 일어나지 않는 환경에서는 바로 물어본다
      returned.current = true;
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') returned.current = true;
    });
    return () => sub.remove();
  }, [pendingCallConfirm]);

  const visible = pendingCallConfirm != null;

  const close = () => setPendingCallConfirm(null);
  const confirm = () => {
    if (pendingCallConfirm) confirmFacility(pendingCallConfirm.facilityId);
    setPendingCallConfirm(null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable
          style={[styles.sheet, { backgroundColor: p.card, borderColor: p.line }]}
          onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.title, { color: p.ink }]}>동반 조건을 확인하셨나요?</Text>
          <Text style={[styles.body, { color: p.muted }]}>
            {pendingCallConfirm ? `${pendingCallConfirm.name}에 ` : ''}전화로 확인하셨다면 알려주세요.
            다른 사용자에게 <Text style={{ color: p.ink, fontWeight: '700' }}>확정된 정보</Text>로 표시됩니다.
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={close}
              style={({ pressed }) => [
                styles.btn,
                { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
              ]}>
              <Text style={[styles.btnText, { color: p.muted }]}>아니요</Text>
            </Pressable>
            <Pressable
              onPress={confirm}
              style={({ pressed }) => [
                styles.btn,
                styles.primary,
                { backgroundColor: pressed ? p.accentDark : p.accent, borderColor: 'transparent' },
              ]}>
              <Text style={[styles.btnText, { color: p.onAccent }]}>확인했어요</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  sheet: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.xl, gap: 10 },
  title: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  body: { fontSize: 13.5, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 8 },
  btn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primary: { borderWidth: 0 },
  btnText: { fontSize: 14.5, fontWeight: '800' },
});
