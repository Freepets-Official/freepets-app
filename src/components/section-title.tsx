import { StyleSheet, Text, View } from 'react-native';

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
  title: { fontSize: 19, fontWeight: '800', letterSpacing: -0.5 },
  caption: { fontSize: 12.5, fontWeight: '600' },
});
