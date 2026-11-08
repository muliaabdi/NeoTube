import { Pressable, View, useColorScheme, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MaterialIcons from '@react-native-vector-icons/material-icons'
import { Image } from 'expo-image'
import { useValue } from '@legendapp/state/react'
import { NouText } from '../NouText'
import { ui$ } from '@/states/ui'
import { settings$ } from '@/states/settings'
import { useTwColor } from '@/lib/theme'

// Primary hero action: big confident surface, deep dark/tint background,
// clear prompt to play. Active scale feels tactile on tablets.
const PrimaryLaunchCard: React.FC<{
  onPress: () => void
  label: string
  sublabel: string
  country?: string | null
}> = ({ onPress, label, sublabel, country }) => {
  const tw = useTwColor()
  const isDark = useColorScheme() !== 'light'

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={sublabel}
      className="group w-full max-w-md flex-row items-center justify-between rounded-3xl bg-zinc-900 p-6 active:scale-[0.98] active:bg-zinc-800 dark:bg-zinc-100 dark:active:bg-zinc-200"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: isDark ? 0.35 : 0.15,
        shadowRadius: 18,
        elevation: 6,
      }}
    >
      <View className="flex-1 pr-4">
        <View className="flex-row items-center gap-2">
          <NouText className="text-2xl font-bold tracking-tight text-white dark:text-zinc-950">
            {label}
          </NouText>
          {country ? (
            <View className="rounded-md bg-zinc-800 px-2 py-0.5 dark:bg-zinc-300">
              <NouText className="text-xs font-semibold uppercase text-zinc-300 dark:text-zinc-800">
                {country}
              </NouText>
            </View>
          ) : null}
        </View>
        <NouText className="mt-1 text-sm text-zinc-400 dark:text-zinc-600">
          {sublabel}
        </NouText>
      </View>
      <View className="h-14 w-14 items-center justify-center rounded-2xl bg-red-600">
        <MaterialIcons name="play-arrow" size={32} color={tw('white') || '#ffffff'} />
      </View>
    </Pressable>
  )
}

// Secondary utility card: muted surface, clean icon treatment.
const SecondaryLaunchCard: React.FC<{
  icon: React.ComponentProps<typeof MaterialIcons>['name']
  label: string
  sublabel: string
  onPress: () => void
}> = ({ icon, label, sublabel, onPress }) => {
  const tw = useTwColor()
  const isDark = useColorScheme() !== 'light'

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="w-full max-w-md flex-row items-center justify-between rounded-2xl border border-zinc-200 bg-white/80 p-5 active:scale-[0.98] active:bg-zinc-100 dark:border-zinc-800/80 dark:bg-zinc-900/60 dark:active:bg-zinc-800/80"
    >
      <View className="flex-row items-center gap-4">
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
          <MaterialIcons
            name={icon}
            size={22}
            color={isDark ? tw('zinc-300') || '#d4d4d8' : tw('zinc-700') || '#3f3f46'}
          />
        </View>
        <View>
          <NouText className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {label}
          </NouText>
          <NouText className="text-xs text-zinc-500 dark:text-zinc-400">
            {sublabel}
          </NouText>
        </View>
      </View>
      <MaterialIcons
        name="chevron-right"
        size={22}
        color={isDark ? tw('zinc-600') || '#52525b' : tw('zinc-400') || '#a1a1aa'}
      />
    </Pressable>
  )
}

// Landing screen for tablet/mobile: warm, minimal, purposeful.
// Leaves the webview warming up underneath.
export const LandingScreen = () => {
  const visible = useValue(ui$.landingVisible)
  const country = useValue(settings$.contentCountry)
  const sponsorBlock = useValue(settings$.sponsorBlock)
  const { width } = useWindowDimensions()
  const isTablet = width >= 600

  if (!visible) {
    return null
  }

  const sbText = sponsorBlock ? 'SponsorBlock aktif' : 'SponsorBlock nonaktif'

  return (
    <View className="absolute inset-0 z-50 bg-zinc-50 dark:bg-zinc-950">
      <SafeAreaView className="flex-1 px-8 py-10 justify-between">
        {/* Brand mark */}
        <View className="items-center pt-8">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-3xl bg-red-600/10 dark:bg-red-500/15">
            <Image
              source={require('@/assets/images/icon.png')}
              style={{ width: 48, height: 48 }}
              contentFit="contain"
            />
          </View>
          <NouText className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            NouTube
          </NouText>
          <NouText className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            YouTube murni tanpa gangguan
          </NouText>
        </View>

        {/* Action cluster: centered, tablet-friendly */}
        <View className={`w-full items-center gap-3 ${isTablet ? 'px-12' : ''}`}>
          <PrimaryLaunchCard
            label="Buka YouTube"
            sublabel={sbText}
            country={country}
            onPress={() => ui$.landingVisible.set(false)}
          />

          <SecondaryLaunchCard
            icon="tune"
            label="Pengaturan"
            sublabel="SponsorBlock, negara, tampilan"
            onPress={() => {
              ui$.landingVisible.set(false)
              ui$.settingsModalOpen.set(true)
            }}
          />
        </View>

        {/* Quiet footer */}
        <View className="items-center pb-2">
          <NouText className="text-xs text-zinc-400 dark:text-zinc-600">
            Tekan kembali kapan saja untuk membuka menu ini
          </NouText>
        </View>
      </SafeAreaView>
    </View>
  )
}
