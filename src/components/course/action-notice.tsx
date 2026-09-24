import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { CardShadow, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';

/**
 * 코스 동작(저장·삭제·담기·공유·공개 전환)의 결과 안내.
 *
 * 예전에는 이 문구를 「내 코스」 블록 안에 그렸다. 그런데 「담기」 버튼은 그보다 한참 아래
 * 「둘러보기」 목록에 있다 — 누르면 확인 문구가 **화면 위쪽 밖**에 떴고, 사용자는 아무 일도
 * 일어나지 않은 줄 알고 또 눌렀다(실기기에서 확인된 문제. 중복 저장의 원인이기도 했다).
 *
 * 그래서 화면 아래에 띄운다. 어디서 눌렀든 보인다.
 *
 * **성공은 스스로 사라지고 실패는 남는다.** 실패 문구에는 다음에 뭘 해야 하는지가 들어 있어
 * (공개 조건·이름 길이 제한 등) 읽을 시간이 필요하다. 성공은 "됐다"가 전부다.
 */
const AUTO_HIDE_MS = 2600;

export function CourseActionNotice({
  message,
  onDismiss,
}: {
  message: { text: string; failed: boolean } | null;
  onDismiss: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!message || message.failed) return;
    const t = setTimeout(onDismiss, AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;
  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(180)}
      style={[styles.wrap, { bottom: insets.bottom + 92 }]}
      pointerEvents="box-none">
      <Pressable
        onPress={onDismiss}
        accessibilityRole="alert"
        /**
         * 안드로이드는 `alert` 역할만으로 읽어주지 않는다. TalkBack이 새로 뜬 문구를 소리내려면
         * 라이브 리전이 필요하다 — 담기 결과를 눈으로 못 보는 사용자에게는 이게 유일한 확인이다.
         */
        accessibilityLiveRegion="polite"
        style={[
          styles.card,
          message.failed
            ? { backgroundColor: p.dangerSoft, borderColor: p.danger }
            : { backgroundColor: p.successSoft, borderColor: p.success },
        ]}>
        <Ionicons
          name={message.failed ? 'alert-circle' : 'checkmark-circle'}
          size={17}
          color={message.failed ? p.danger : p.success}
        />
        <Text style={[styles.text, { color: message.failed ? p.danger : p.ink }]}>
          {message.text}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 200 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '100%',
    maxWidth: MaxContentWidth,
    marginHorizontal: Spacing.lg,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    ...CardShadow,
  },
  text: { flex: 1, fontSize: Type.footnote, lineHeight: 19, fontWeight: '700' },
});
