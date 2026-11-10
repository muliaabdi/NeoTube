import { FlatList, Pressable, View } from 'react-native'
import { NouText } from '../NouText'
import { useMemo } from 'react'
import { nIf } from '@/lib/utils'
import { useValue } from '@legendapp/state/react'
import { updateUrl, ui$ } from '@/states/ui'
import { localVideos$, LocalVideoEntry } from '@/states/downloads-index'
import { BaseModal } from './BaseModal'
import { t } from 'i18next'
import MaterialIcons from '@react-native-vector-icons/material-icons'

export const DownloadsModal = () => {
  const isOpen = useValue(ui$.downloadsModalOpen)
  const videosMap = useValue(localVideos$)

  const items = useMemo(() => {
    return Object.values(videosMap || {}).sort((a, b) => (b.downloadedAt || 0) - (a.downloadedAt || 0))
  }, [videosMap])

  const handleOpenVideo = (item: LocalVideoEntry) => {
    const watchUrl = `https://m.youtube.com/watch?v=${item.videoId}`
    updateUrl(watchUrl)
    ui$.downloadsModalOpen.set(false)
  }

  return nIf(
    isOpen,
    <BaseModal isOpen={isOpen} onClose={() => ui$.downloadsModalOpen.set(false)}>
      <View className="flex-row items-center justify-between pb-3">
        <NouText className="font-semibold text-lg">{t('settings.showDownloadsButtonInHeader') || 'Downloads'}</NouText>
        <NouText className="text-sm text-gray-400">{items.length} {t('modals.videos') || 'videos'}</NouText>
      </View>
      {items.length === 0 ? (
        <View className="py-12 items-center justify-center">
          <MaterialIcons name="file-download" size={40} color="#666" />
          <NouText className="text-gray-400 mt-2">{t('modals.noDownloads') || 'No downloaded videos'}</NouText>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.videoId}
          renderItem={({ item }) => (
            <Pressable
              className="flex-row items-center py-3 border-b border-gray-800"
              onPress={() => handleOpenVideo(item)}
            >
              <MaterialIcons
                name={item.audioOnly ? 'audiotrack' : 'play-circle-outline'}
                size={28}
                color="#f87171"
              />
              <View className="ml-3 flex-1">
                <NouText className="text-white text-sm" numberOfLines={2}>
                  {item.title || item.videoId}
                </NouText>
                <NouText className="text-gray-400 text-xs mt-1">
                  {item.audioOnly ? 'Audio' : 'Video'}
                  {item.downloadedAt ? ` • ${new Date(item.downloadedAt).toLocaleDateString()}` : ''}
                </NouText>
              </View>
            </Pressable>
          )}
        />
      )}
    </BaseModal>,
  )
}
