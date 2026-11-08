import { Pressable, View, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MaterialIcons from '@react-native-vector-icons/material-icons'
import { useValue } from '@legendapp/state/react'
import { NouText } from '../NouText'
import { ui$ } from '@/states/ui'
import { useTwColor } from '@/lib/theme'

const LandingCard: React.FC<{
  icon: React.ComponentProps<typeof MaterialIcons>['name']
  label: string
  onPress: () => void
}> = ({ icon, label, onPress }) => {
  const tw = useTwColor()
  const isDark = useColorScheme() !== 'light'
  return (
    <Pressable
      onPress={onPress}
      className="w-56 flex-row items-center gap-4 rounded-3xl bg-zinc-100 px-6 py-5 active:bg-zinc-200 dark:bg-zinc-900 dark:active:bg-zinc-800"
    >
      <MaterialIcons name={icon} size={28} color={isDark ? tw('zinc-100') : tw('zinc-900')} />
      <NouText className="text-lg font-medium">{label}</NouText>
    </Pressable>
  )
}

// C-full launch screen: two entries — the app itself and its settings. It sits
// above the webview so the page keeps warming up underneath.
export const LandingScreen = () => {
  const visible = useValue(ui$.landingVisible)
  if (!visible) {
    return null
  }
  return (
    <View className="absolute inset-0 z-50 bg-white dark:bg-zinc-950">
      <SafeAreaView className="flex-1 items-center justify-center gap-4">
        <LandingCard
          icon="play-circle"
          label="App"
          onPress={() => ui$.landingVisible.set(false)}
        />
        <LandingCard
          icon="settings"
          label="Settings"
          onPress={() => {
            ui$.landingVisible.set(false)
            ui$.settingsModalOpen.set(true)
          }}
        />
      </SafeAreaView>
    </View>
  )
}
