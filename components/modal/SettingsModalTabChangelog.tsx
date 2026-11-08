import { View } from 'react-native'
import MaterialIcons from '@react-native-vector-icons/material-icons'
import { version } from '../../package.json'
import { NouText } from '../NouText'
import { useTwColor } from '@/lib/theme'

const surfaceCls = 'overflow-hidden rounded-[24px] bg-white dark:bg-zinc-900'

const changelogEntries = [
  {
    tag: `v${version}`,
    date: '2026-11-08',
    isCurrent: true,
    items: [
      'Rebranding aplikasi menjadi NeoTube',
      'Penyesuaian UI tablet dan mobile-first experience',
      'Fitur Miniplayer dengan gestur swipe down saat memutar video',
      'Dukungan integrasi SponsorBlock dan optimasi pemutaran latar belakang',
    ],
  },
]

export const SettingsChangelogContent = () => {
  const tw = useTwColor()

  return (
    <View className="gap-4">
      {changelogEntries.map((entry) => (
        <View
          key={entry.tag}
          className="rounded-[24px] bg-white dark:bg-zinc-900 px-4 py-4"
        >
          <View className="flex-row items-start gap-3">
            <View className="mt-0.5 h-10 w-10 items-center justify-center rounded-2xl border border-blue-500 bg-zinc-100 dark:bg-zinc-950">
              <MaterialIcons name="history" color={tw('blue-300')} size={18} />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <NouText className="flex-1 text-base font-semibold tracking-tight">{entry.tag}</NouText>
                {entry.isCurrent ? (
                  <View className="rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-1">
                    <NouText className="text-[10px] uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">
                      Versi Saat Ini
                    </NouText>
                  </View>
                ) : null}
              </View>
              <NouText className="mt-1 text-sm text-zinc-500">{entry.date}</NouText>
              <View className="mt-4 gap-2">
                {entry.items.map((item, idx) => (
                  <View className="flex-row gap-2" key={idx}>
                    <NouText className="text-sm leading-6 text-zinc-500">{'\u2022'}</NouText>
                    <NouText className="flex-1 text-sm leading-6 text-zinc-800 dark:text-zinc-200">{item}</NouText>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  )
}
