import { useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Image,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GalleryPhoto } from '@/lib/chatUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  photos: GalleryPhoto[];
  initialIndex: number;
  onClose: () => void;
}

export default function GalleryViewer({ visible, photos, initialIndex, onClose }: Props) {
  const flatListRef = useRef<FlatList>(null);
  const currentIdx = useRef(initialIndex);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
      if (viewableItems.length > 0 && viewableItems[0]!.index !== null) {
        currentIdx.current = viewableItems[0]!.index;
      }
    },
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: GalleryPhoto }) => (
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={styles.slide}>
        <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="cover" />
        {item.caption ? (
          <View style={styles.captionBar}>
            <Text style={styles.captionText}>{item.caption}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    ),
    [onClose],
  );

  if (!photos.length) return null;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.container}>
        <FlatList
          ref={flatListRef}
          data={photos}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        />

        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>

        {/* Counter */}
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {(currentIdx.current) + 1} of {photos.length}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  closeBtn: {
    position: 'absolute',
    top: 54,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  counter: {
    position: 'absolute',
    top: 54,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  captionBar: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  captionText: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
  },
});
