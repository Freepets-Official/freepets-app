import { useEffect, useState } from 'react';
import { Text, type TextProps } from 'react-native';

/**
 * 0에서 목표 숫자까지 굴러 올라가는 카운트업. 대시보드·통계 지표에 생동감을 준다.
 * value가 바뀌면 다시 애니메이션. 소수 자릿수(decimals) 지원.
 */
export function CountUp({
  value,
  duration = 900,
  decimals = 0,
  suffix = '',
  prefix = '',
  ...text
}: TextProps & {
  value: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }
    let raf = 0;
    let start = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf = requestAnimationFrame(step);
      else setDisplay(value);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <Text {...text}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </Text>
  );
}
