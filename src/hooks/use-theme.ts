import { Palette, type PaletteColors } from '@/constants/theme';

/** 앱은 라이트 테마로 고정한다 — 항상 화이트 배경 + 파스텔 핑크. */
export function usePalette(): PaletteColors {
  return Palette.light;
}
