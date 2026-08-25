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

/**
 * 현재 적용 중인 색 스킴. auto는 렌더 시점의 시간(저녁~새벽 다크)으로 결정한다.
 * 앱을 켜 둔 채 시각이 넘어가는 실시간 전환까진 필요 없다(재렌더·재진입 시 반영).
 */
export function useColorScheme(): 'light' | 'dark' {
  const { settings } = useAppStore();
  return resolveScheme(settings.themeMode, new Date().getHours());
}

/** 현재 스킴의 팔레트. 화면 모드가 바뀌면 이 훅을 쓰는 모든 컴포넌트가 다시 그려진다. */
export function usePalette(): PaletteColors {
  return Palette[useColorScheme()];
}
