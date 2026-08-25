import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { Palette, type PaletteColors, type ThemeMode } from '@/constants/theme';
import { useAppStore } from '@/store/app-store';

/** auto 모드에서 다크로 보는 시간대: 저녁 19시 ~ 새벽 6시 직전 */
export function isDarkHour(hour: number): boolean {
  return hour >= 19 || hour < 6;
}

/** 설정 모드 + 시각 → 실제 적용할 스킴. auto만 시간에 따라 갈린다. */
export function resolveScheme(mode: ThemeMode, hour: number): 'light' | 'dark' {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  return isDarkHour(hour) ? 'dark' : 'light';
}

/** now 기준 다음 경계(06:00 또는 19:00)까지 남은 밀리초 */
function msUntilNextBoundary(now: Date): number {
  const next = new Date(now);
  const h = now.getHours();
  if (h < 6) next.setHours(6, 0, 0, 0);
  else if (h < 19) next.setHours(19, 0, 0, 0);
  else {
    next.setDate(next.getDate() + 1);
    next.setHours(6, 0, 0, 0);
  }
  return next.getTime() - now.getTime();
}

type ThemeValue = { scheme: 'light' | 'dark'; palette: PaletteColors };
const ThemeContext = createContext<ThemeValue | null>(null);

/**
 * 앱 전역 테마를 한곳에서 관리한다. 화면 모드는 스토어(settings.themeMode)에서 읽고,
 * 실제 스킴은 여기서 상태로 들고 있다가 소비자에게 컨텍스트로 내려준다.
 *
 * auto 모드에선 렌더 시점 계산만으론 경계(저녁/새벽)에 안 바뀌므로,
 * ① 다음 경계에 타이머를 걸어 그 순간 재계산하고
 * ② 포그라운드 복귀 시 재계산해(백그라운드 사이 경계를 넘겼을 수 있음) 스스로 전환시킨다.
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useAppStore();
  const mode = settings.themeMode;
  const [scheme, setScheme] = useState<'light' | 'dark'>(() =>
    resolveScheme(mode, new Date().getHours()),
  );

  useEffect(() => {
    const recompute = () => setScheme(resolveScheme(mode, new Date().getHours()));
    recompute(); // 모드가 바뀌면 즉시 반영

    if (mode !== 'auto') return; // 수동(라이트·다크)은 타이머·리스너가 필요 없다

    // 다음 경계에 재계산 예약. recompute가 scheme를 바꾸면 이 이펙트가 다시 돌며
    // 그다음 경계로 재예약된다(19시→다크 후 06시 예약).
    const timer = setTimeout(recompute, msUntilNextBoundary(new Date()));
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') recompute();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [mode, scheme]);

  const value = useMemo<ThemeValue>(() => ({ scheme, palette: Palette[scheme] }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** 현재 적용 중인 색 스킴. 프로바이더 밖에서 쓰이면(이론상 없음) 라이트로 폴백. */
export function useColorScheme(): 'light' | 'dark' {
  return useContext(ThemeContext)?.scheme ?? 'light';
}

/** 현재 스킴의 팔레트. 화면 모드가 바뀌면 이 훅을 쓰는 모든 컴포넌트가 다시 그려진다. */
export function usePalette(): PaletteColors {
  return useContext(ThemeContext)?.palette ?? Palette.light;
}
