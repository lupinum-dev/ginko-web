import type { Framework, FrameworkConfig } from '../../types/framework'
import { AstroTaskProcessor } from '../configs/astro/AstroTaskProcessor'
import { astroFileTypes } from '../configs/astro/fileTypes'
import { astroPaths } from '../configs/astro/paths'
import { nuxtFileTypes } from '../configs/nuxt/fileTypes'
import { NuxtTaskProcessor } from '../configs/nuxt/NuxtTaskProcessor'
import { nuxtPaths } from '../configs/nuxt/paths'

export class FrameworkService {
  private static configs: Record<Framework, FrameworkConfig> = {
    nuxt: {
      fileTypes: nuxtFileTypes,
      taskProcessor: new NuxtTaskProcessor(),
      paths: nuxtPaths,
    },
    astro: {
      fileTypes: astroFileTypes,
      taskProcessor: new AstroTaskProcessor(),
      paths: astroPaths,
    },
  }

  public static getConfig(framework: Framework): FrameworkConfig {
    return this.configs[framework]
  }
}
