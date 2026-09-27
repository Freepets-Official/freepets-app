import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { CardShadow, MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { CATEGORY_LABEL, type Facility } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';

/**
 * 스톱 순서를 손가락으로 바꾸는 시트.
 *
 * 목록 화면에서 바로 끌지 않고 **따로 연 이유**는 두 가지다.
 * ① 코스 목록은 세로 스크롤 안에 있다. 행을 끌 수 있게 만들면 스크롤과 드래그가 같은
 *    제스처를 놓고 다퉈, 스크롤하려다 순서가 바뀌는 일이 생긴다.
 * ② 목록의 행은 높이가 제각각이다(이름이 길면 두 줄). 드래그는 "몇 칸 옮겼는가"를 높이로
 *    계산하므로 높이가 같아야 정확하다. 여기서는 한 행을 고정 높이로 그린다.
 *
 * 순서는 **확인을 눌러야** 반영된다. 끌다가 손을 떼는 순간 코스가 바뀌면, 잘못 끌었을 때
 * 되돌릴 방법이 없다.
 */
const ROW_H = 58;
const GAP = 8;
const SLOT = ROW_H + GAP;

export function StopReorderSheet({
  visible,
  stopIds,
  facilityOf,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  /**
   * 스톱 **전부**의 ID. 상세를 못 받은 장소도 들어 있다.
   *
   * 예전에는 이미 걸러진 `Facility[]`를 받았는데, 그러면 확인을 누르는 순간 **못 불러온
   * 장소가 코스에서 사라졌다** — 순서만 바꾸려던 사용자가 스톱을 잃는다.
   */
  stopIds: number[];
  /** ID로 시설을 찾는다. 없으면 자리만 남기고 "불러오지 못함"으로 그린다 */
  facilityOf: (id: number) => Facility | undefined;
  onClose: () => void;
  /** 확인을 눌렀을 때만 불린다. 바뀐 순서의 시설 ID 목록 — 받은 것을 하나도 빠뜨리지 않는다 */
  onConfirm: (facilityIds: number[]) => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<number[]>(stopIds);

  /**
   * 시트를 **열 때만** 바깥의 순서를 들여온다.
   *
   * `stopIds`를 의존성에 넣어도 되는 것은 `visible`이 켜지는 순간만 보기 때문이다. 값 자체로
   * 다시 초기화하면 부모가 한 번만 다시 그려도 **끌던 순서가 제자리로 돌아간다.**
   */
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) setOrder(stopIds);
    wasVisible.current = visible;
  }, [visible, stopIds]);

  const move = useCallback((from: number, to: number) => {
    setOrder((prev) => {
      if (to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [picked] = next.splice(from, 1);
      next.splice(to, 0, picked);
      return next;
    });
  }, []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.fill}>
        <Pressable style={[styles.backdrop, { backgroundColor: 'rgba(20,12,30,0.45)' }]} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: p.bg, paddingBottom: insets.bottom + Spacing.lg },
          ]}>
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: p.line }]} />
          </View>

          <Text style={[styles.title, { color: p.ink }]}>순서 바꾸기</Text>
          <Text style={[styles.hint, { color: p.muted }]}>
            꾹 눌러서 위아래로 끌면 순서가 바뀌어요
          </Text>

          <View style={{ height: order.length * SLOT }}>
            {order.map((id, i) => (
              <DraggableRow
                key={id}
                facility={facilityOf(id)}
                index={i}
                count={order.length}
                onMove={move}
                onShift={(dir) => move(i, i + dir)}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.btn,
                { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
              ]}>
              <Text style={[styles.btnText, { color: p.muted }]}>취소</Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirm(order)}
              style={({ pressed }) => [
                styles.btn,
                { borderColor: p.accent, backgroundColor: pressed ? p.accentDark : p.accent },
              ]}>
              <Text style={[styles.btnText, { color: p.onAccent }]}>이 순서로 하기</Text>
            </Pressable>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/**
 * 한 행. 꾹 누르면 들리고, 끌면 따라온다.
 *
 * 한 칸을 지날 때마다 **목록 자체를 바로 바꾼다.** 그러면 나머지 행은 평범한 리렌더로
 * 제자리를 찾아가고, 행마다 애니메이션 상태를 들고 서로 맞추는 일을 안 해도 된다.
 * 대신 이 행의 `top`이 뛰므로 그만큼을 translate에서 빼, 손가락 밑에 계속 붙어 있게 한다.
 */
function DraggableRow({
  facility,
  index,
  count,
  onMove,
  onShift,
}: {
  /** 상세를 못 받았으면 undefined — 자리는 지키고 "불러오지 못함"으로 그린다 */
  facility: Facility | undefined;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  /** 스크린 리더용 — 끌지 않고 한 칸씩 옮긴다 */
  onShift: (direction: -1 | 1) => void;
}) {
  const p = usePalette();
  /** 손가락이 움직인 거리 */
  const y = useSharedValue(0);
  const lifted = useSharedValue(0);
  /**
   * 이번 드래그에서 **이미 목록에 반영한** 칸 수.
   *
   * 한 칸을 넘을 때마다 목록 상태를 바꾸므로 이 행의 `index`도 따라 바뀐다. 그러면
   * `top`(= index × 칸높이)이 이동한 만큼 뛰는데, 손가락은 그대로다. 그 차이를 여기서 뺀다 —
   * 빼지 않으면 한 칸 옮길 때마다 행이 손가락보다 두 칸씩 달아난다.
   */
  const shifted = useSharedValue(0);
  /** 드래그를 시작한 순간의 자리. 드래그 중에 index가 변하므로 기준을 따로 잡아야 한다 */
  const startIndex = useSharedValue(index);

  const drag = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart(() => {
      lifted.value = withTiming(1, { duration: 120 });
      startIndex.value = index;
      shifted.value = 0;
      y.value = 0;
    })
    .onUpdate((e) => {
      y.value = e.translationY;
      const step = Math.round(e.translationY / SLOT);
      if (step !== shifted.value) {
        // 지금 있는 자리에서 목표 자리로. 둘 다 **시작 자리 기준**이라 중복해서 세지 않는다
        const from = startIndex.value + shifted.value;
        const to = startIndex.value + step;
        if (to >= 0 && to < count) {
          shifted.value = step;
          runOnJS(onMove)(from, to);
        }
      }
    })
    .onFinalize(() => {
      // 남은 어긋남만 제자리로 당긴다. 0으로 보내면 이미 옮겨간 칸만큼 되돌아가 버린다
      y.value = withSpring(shifted.value * SLOT, { damping: 18, stiffness: 200 });
      lifted.value = withTiming(0, { duration: 140 });
    });

  const style = useAnimatedStyle(() => ({
    top: index * SLOT,
    transform: [
      { translateY: y.value - shifted.value * SLOT },
      { scale: 1 + lifted.value * 0.03 },
    ],
    zIndex: lifted.value > 0 ? 10 : 1,
    shadowOpacity: lifted.value * 0.18,
  }));

  return (
    <GestureDetector gesture={drag}>
      <Animated.View
        /**
         * 스크린 리더는 드래그를 쓸 수 없다. VoiceOver·TalkBack에서 「위로」·「아래로」
         * 동작으로 한 칸씩 옮길 수 있게 열어 둔다 — 순서 바꾸기가 그들에게만 막히면 안 된다.
         */
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${index + 1}번째, ${facility ? facility.name : '불러오지 못한 장소'}`}
        accessibilityHint="꾹 눌러 끌거나, 위로·아래로 동작으로 순서를 바꿀 수 있어요"
        accessibilityActions={[
          { name: 'increment', label: '위로 옮기기' },
          { name: 'decrement', label: '아래로 옮기기' },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') onShift(-1);
          else if (e.nativeEvent.actionName === 'decrement') onShift(1);
        }}
        style={[
          styles.row,
          { backgroundColor: p.card, borderColor: p.line, shadowColor: '#000' },
          style,
        ]}>
        <View style={[styles.orderDot, { backgroundColor: p.accentSoft }]}>
          <Text style={[styles.orderNum, { color: p.accent }]}>{index + 1}</Text>
        </View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowName, { color: facility ? p.ink : p.muted }]} numberOfLines={1}>
            {facility ? facility.name : '불러오지 못한 장소'}
          </Text>
          <Text style={[styles.rowCat, { color: p.muted }]} numberOfLines={1}>
            {facility ? CATEGORY_LABEL[facility.category] : '이름은 없지만 코스에는 남아 있어요'}
          </Text>
        </View>
        <Ionicons name="reorder-three" size={22} color={p.muted} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    ...CardShadow,
  },
  handleWrap: { alignItems: 'center', paddingVertical: 10 },
  handle: { width: 38, height: 4, borderRadius: Radius.full },
  title: { fontSize: Type.sheetTitle, fontWeight: '900', letterSpacing: -0.4 },
  hint: { fontSize: Type.footnote, marginTop: 3, marginBottom: Spacing.lg },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  orderDot: { width: 24, height: 24, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  orderNum: { fontSize: Type.caption, fontWeight: '900' },
  rowBody: { flex: 1, gap: 2 },
  rowName: { fontSize: Type.bodyLg, fontWeight: '800' },
  rowCat: { fontSize: Type.caption },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xl },
  btn: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingVertical: 12,
  },
  btnText: { fontSize: Type.callout, fontWeight: '800' },
});
