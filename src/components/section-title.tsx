import { StyleSheet, View } from 'react-native';

import { Type } from '@/constants/theme';
import { Text } from '@/components/text';
import { usePalette } from '@/hooks/use-theme';

interface SectionTitleProps {
  title: string;
  caption?: string;
}

export function SectionTitle({ title, caption }: SectionTitleProps) {
  const p = usePalette();
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: p.ink }]}>{title}</Text>
      {caption ? <Text style={[styles.caption, { color: p.muted }]}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  title: { fontSize: Type.sectionTitle, fontWeight: '800', letterSpacing: -0.5 },
  caption: { fontSize: Type.footnote, fontWeight: '600' },
});
