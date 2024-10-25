# vite-image-to-avif-plugin

![Vite AVIF](https://github.com/ryotanakata/vite-image-to-avif-plugin/raw/main/docs/assets/logos.png)

**Simple** | **Efficient** | **Automated** | **Vite-Optimized**

Automatically converts images to AVIF during Vite builds, optimizing performance with minimal effort.

## Features

- **Automatic AVIF conversion**: Convert images to AVIF format automatically during the Vite build process.
- **Customizable quality**: Easily adjust AVIF quality for fine-tuning file sizes and visual fidelity.
- **Cache system**: Skip already converted images to optimize build time.
- **Wide format support**: Convert multiple image formats, including PNG, JPEG, WEBP, TIFF, and HEIC.
- **Flexible output settings**: Specify custom output directories and structure preservation options.
- **Fast and lightweight**: Designed to work efficiently within your Vite workflow without slowing down development.

## Install

### npm

```bash
npm install vite-image-to-avif-plugin --save-dev
```

### yarn

```bash
yarn add vite-image-to-avif-plugin --dev
```

### pnpm

```bash
pnpm add vite-image-to-avif-plugin --save-dev
```

## Basic Usage

Add `vite-image-to-avif-plugin` to your Vite configuration (`vite.config.js` or `vite.config.ts`).

```js
// vite.config.js
import { defineConfig } from "vite";
import { viteImageToAVIFPlugin } from "vite-image-to-avif-plugin";

export default defineConfig({
  plugins: [
    viteImageToAVIFPlugin({
      sourcePaths: ["src/assets/images"],
      quality: 90, // Optional: Adjust AVIF quality (default is 80)
      outputDir: "dist/images", // Optional: Specify output directory (default is process.cwd())
      preserveStructure: true, // Optional: Maintain source directory structure in output (default is true)
    }),
  ],
});
```

Once configured, your image assets will be automatically converted to AVIF format during the Vite build process.

## How It Works

1. The plugin scans the directories specified in `sourcePaths` for images with extensions defined in `imageExtensions`.
2. For each image, it checks if the file has already been converted by using a cache system that stores the file's last modification time (mtime).
3. If the image has not been converted or has been modified, the plugin uses [Sharp](https://sharp.pixelplumbing.com/) to convert the image to AVIF format.
4. The converted image is saved to the specified `outputDir`. With `preserveStructure` enabled, the directory structure relative to the project root will be maintained.

## Options

You can customize the behavior of the plugin using the following options:

| Option              | Type       | Default                                                           | Description                                                                                       |
| ------------------- | ---------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `sourcePaths`       | `string[]` | `['src']`                                                         | The directories containing images to be converted.                                                |
| `quality`           | `number`   | `80`                                                              | AVIF quality (from 0 to 100). Lower values reduce file size at the cost of image quality.         |
| `outputDir`         | `string`   | `process.cwd()`                                                   | The directory where the converted AVIF files will be saved.                                       |
| `imageExtensions`   | `string[]` | `['png', 'jpg', 'jpeg', 'webp', 'tiff', 'heic']`                  | The image file extensions to process.                                                             |
| `concurrency`       | `number`   | `5`                                                               | The maximum number of images to convert concurrently.                                             |
| `cacheDir`          | `string`   | `path.resolve(process.cwd(), '.cache/vite-image-to-avif-plugin')` | The directory where the plugin stores its cache files.                                            |
| `preserveStructure` | `boolean`  | `true`                                                            | If `true`, maintains the source directory structure in the output directory; otherwise, flattens. |

### Example

```js
import { defineConfig } from "vite";
import { viteImageToAVIFPlugin } from "vite-image-to-avif-plugin";

export default defineConfig({
  plugins: [
    viteImageToAVIFPlugin({
      sourcePaths: ["src/images/a", "src/images/b", "src/images/c"], // Multiple source paths
      quality: 90, // Higher quality
      outputDir: "dist/optimized-images", // Custom output directory
      imageExtensions: ["png", "jpg"], // Only process PNG and JPG images
      concurrency: 10, // Increase concurrency
      cacheDir: ".cache/avif-plugin", // Custom cache directory
      preserveStructure: false, // Flatten output directory structure
    }),
  ],
});
```

## Supported Image Formats

The following image formats can be converted to AVIF (configurable via the `imageExtensions` option):

- PNG
- JPEG/JPG
- WEBP
- TIFF
- HEIC

## Cache System

To avoid redundant conversions and improve build performance, the plugin uses a simple cache system based on file modification times (mtimes). If an image's content hasn't changed since the last build, the plugin will skip the conversion.

## Logging

The plugin provides useful feedback during the build process:

- **Converted**: When an image is successfully converted to AVIF.
- **Skipping**: When an image is skipped because it has already been converted and hasn't changed.
- **Failed to convert**: If an error occurs during the conversion process.

## Cleanup

If you need to remove the AVIF images or reset the cache, you can manually delete the cache directory (default is `.cache/vite-image-to-avif-plugin`) and the output directory.

## TypeScript Support

This plugin is fully compatible with TypeScript. You can import and configure it within a TypeScript-based Vite project:

```ts
import { defineConfig } from "vite";
import { viteImageToAVIFPlugin } from "vite-image-to-avif-plugin";

export default defineConfig({
  plugins: [
    viteImageToAVIFPlugin({
      sourcePaths: ["src/images"],
      quality: 85,
    }),
  ],
});
```

## License

MIT
