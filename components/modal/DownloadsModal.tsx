import { FlatList, Pressable, View } from 'react-native'
import { NouText } from '../NouText'
import { nIf } from '@/lib/utils'
import { useValue } from '@legendapp/state/react'
import { ui$, updateUrl } from '@/states/ui'
import { downloads$, listDownloads, removeDownload } from '@/states/downloads'
import { extractVideoId, localVideos$ } from '@/states/downloads-index'
import { BaseModal } from './BaseModal'
import { t } from 'i18next'
import { mainClient } from '@/lib/main-client'
import MaterialIcons from '@react-native-vector-icons/material-icons'

// Same store as the download history in the tools modal (states/downloads.ts),
// supplemented by localVideos$ so entries from earlier builds or cleared
// tool history remain reachable from the navbar Downloads list.
export const DownloadsModal = () => {
  const isOpen = useValue(ui$.downloadsModalOpen)
  // Subscribe via selector so in-place key mutations on downloads$ / localVideos$
  // recompute the list instead of keeping a stale object reference.
  const items = useValue(() => listDownloads(downloads$.get(), localVideos$.get()))

  const handleOpenVideo = (url: string) => {
    updateUrl(url)
    ui$.downloadsModalOpen.set(false)
  }

  const handleDelete = (url: string, savedPath: string) => {
    // Index first: the overlay reads it, so the entry must vanish even when
    // the file delete fails (already-gone file, offline storage).
    removeDownload(url)
    const videoIdFromUrl = extractVideoId(url)
    const indexed = localVideos$.get()
    const matchKey = Object.entries(indexed).find(
      ([key, entry]) => (savedPath && entry.uri === savedPath) || (videoIdFromUrl && key === videoIdFromUrl),
    )?.[0]
    if (matchKey) {
      localVideos$.set(Object.fromEntries(Object.entries(indexed).filter(([key]) => key !== matchKey)))
    }
    if (savedPath) mainClient.deleteLocalMedia(savedPath).catch(() => undefined)
  }

  return nIf(
    isOpen,
    <BaseModal onClose={() => ui$.downloadsModalOpen.set(false)}>
      <View className="flex-row items-center justify-between pb-3 px-4 pt-1">
        <NouText className="font-semibold text-lg">{t('downloads.title')}</NouText>
        <NouText className="text-sm text-gray-400">
          {items.length} {t('downloads.videos')}
        </NouText>
      </View>
      {items.length === 0 ? (
        <View className="py-12 px-4 items-center justify-center">
          <MaterialIcons name="file-download" size={40} color="#666" />
          <NouText className="text-gray-400 mt-2">{t('downloads.noDownloads')}</NouText>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.url}
          renderItem={({ item }) => {
            const status =
              item.phase === 'downloading'
                ? `${Math.round(item.progress || 0)}%`
                : item.phase === 'error'
                  ? item.errorMsg || t('modals.downloadFailed')
                  : item.audioOnly
                    ? 'Audio'
                    : 'Video'
            return (
              <View className="flex-row items-center py-3 px-4 border-b border-zinc-200 dark:border-gray-800">
                <Pressable
                  className="flex-row items-center flex-1 min-w-0 mr-2"
                  disabled={item.phase !== 'done'}
                  onPress={() => handleOpenVideo(item.url)}
                >
                  <MaterialIcons
                    name={item.audioOnly ? 'audiotrack' : 'play-circle-outline'}
                    size={28}
                    color={item.phase === 'done' ? '#f87171' : '#666'}
                  />
                  <View className="ml-3 flex-1">
                    <NouText className="text-sm" numberOfLines={2}>
                      {item.title || item.url}
                    </NouText>
                    <NouText className="text-gray-400 text-xs mt-1" numberOfLines={1}>
                      {status}
                    </NouText>
                  </View>
                </Pressable>
                <View className="shrink-0">
                  <Pressable
                    style={({ pressed }) => ({ padding: 12, opacity: pressed ? 0.5 : 1 })}
                    hitSlop={12}
                    onPress={() => handleDelete(item.url, item.savedPath)}
                    accessibilityLabel={t('downloads.delete')}
                  >
                    <MaterialIcons name="delete-outline" size={22} color="#9ca3af" />
                  </Pressable>
                </View>
              </View>
            )
          }}
        />
      )}
    </BaseModal>,
  )
}
