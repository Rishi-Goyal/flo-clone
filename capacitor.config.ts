import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.rishi.bloom',
  appName: 'Bloom',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
}

export default config
