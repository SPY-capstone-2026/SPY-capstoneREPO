import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Image } from 'react-native';
import { Package } from 'lucide-react-native';

import { MoniMascot } from '@/components/mascot';
import { colors } from '@/constants/colors';
import {
  getCharacterColor,
  getShopItemSource,
  getShopItemSourceByName,
} from '@/services/shopCatalog';
import type { ShopItem } from '@/types/api';

type Props = {
  item?: Pick<ShopItem, 'name' | 'image_url' | 'category'> | null;
  name?: string;
  category?: string;
  style?: StyleProp<ViewStyle>;
  contain?: boolean;
};

export function ShopItemVisual({
  item,
  name,
  category,
  style,
  contain = true,
}: Props) {
  const resolvedName = item?.name ?? name ?? '';
  const resolvedCategory = item?.category ?? category ?? '';

  if (resolvedCategory === 'CHARACTER') {
    return (
      <View style={[styles.container, style]}>
        <MoniMascot
          size={92}
          color={getCharacterColor(resolvedName) ?? '#F6C95E'}
          motionEnabled={false}
        />
      </View>
    );
  }

  const source = item
    ? getShopItemSource(item)
    : getShopItemSourceByName(resolvedName);

  return (
    <View style={[styles.container, style]}>
      {source ? (
        <Image
          source={source}
          style={styles.image}
          resizeMode={contain ? 'contain' : 'cover'}
        />
      ) : (
        <Package
          size={38}
          color={colors.butterDeep}
          strokeWidth={1.9}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
