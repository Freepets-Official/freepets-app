import Svg, { Circle, Ellipse, G } from 'react-native-svg';

/**
 * 여권에 찍힌 도장 모양.
 *
 * 홈의 「여권 도장첩」 입구에 쓰던 발자국 아이콘(`Ionicons footsteps`)을 대신한다. 아이콘은
 * 앱 다른 곳에서도 쓰는 기호라 "도장을 모은다"는 것이 읽히지 않았다 — 실제 여권 도장처럼
 * **흰 바탕에 빨간 테두리**를 두르면 무엇을 모으는지가 그림만으로 전해진다.
 *
 * 가운데는 글자가 아니라 **강아지 발자국**이다. 글자를 넣으면 지역명·날짜 같은 정보로
 * 읽혀서 실제 도장첩의 내용과 어긋난다.
 *
 * 색은 넘겨받는다. 도장 잉크의 빨강은 팔레트의 `danger`(판별 '불가')와 의미가 겹치므로,
 * 쓰는 쪽에서 도장 전용 색을 준다.
 */
export function StampMark({
  size = 34,
  color,
  background,
}: {
  size?: number;
  /** 테두리와 발바닥 색 — 도장 잉크 */
  color: string;
  /** 도장 안쪽 바탕. 종이 위에 찍힌 느낌이라 보통 흰색이다 */
  background: string;
}) {
  // 100×100 좌표계로 그리고 size로 줄인다 — 어디에 놓든 비율이 같다
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* 바깥 테두리 두 줄 — 실제 여권 도장의 이중 링 */}
      <Circle cx={50} cy={50} r={46} fill={background} stroke={color} strokeWidth={6} />
      <Circle cx={50} cy={50} r={36} fill="none" stroke={color} strokeWidth={2.5} opacity={0.85} />

      {/* 강아지 발자국 — 발가락 넷과 발바닥 */}
      <G fill={color}>
        <Ellipse cx={38} cy={40} rx={5.4} ry={7} transform="rotate(-18 38 40)" />
        <Ellipse cx={50} cy={35.5} rx={5.4} ry={7.2} />
        <Ellipse cx={62} cy={40} rx={5.4} ry={7} transform="rotate(18 62 40)" />
        <Ellipse cx={70} cy={51} rx={4.6} ry={6} transform="rotate(34 70 51)" />
        <Ellipse cx={30} cy={51} rx={4.6} ry={6} transform="rotate(-34 30 51)" />
        <Ellipse cx={50} cy={60} rx={13} ry={11} />
      </G>
    </Svg>
  );
}
