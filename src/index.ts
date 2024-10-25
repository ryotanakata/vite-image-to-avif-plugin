import path from "path";
import sharp from "sharp";
import { promises as fs } from "fs";
import { Plugin, createLogger } from "vite";
import pLimit from "p-limit";

type AvifPluginOptions = {
  sourcePaths?: string[];
  quality?: number;
  outputDir?: string;
  imageExtensions?: string[];
  concurrency?: number;
  cacheDir?: string;
  preserveStructure?: boolean;
};

type ImageCache = Record<string, number>;

/**
 * Vite plugin to convert images to AVIF format.
 *
 * @param {AvifPluginOptions} options - Plugin options
 * @returns {Plugin} - Vite plugin object
 */
const viteImageToAVIFPlugin = ({
  sourcePaths = ["src"],
  quality = 80,
  outputDir = process.cwd(),
  imageExtensions = ["png", "jpg", "jpeg", "webp", "tiff", "heic"],
  concurrency = 5,
  cacheDir = path.resolve(process.cwd(), ".cache", "vite-image-to-avif-plugin"),
  preserveStructure = true,
}: AvifPluginOptions): Plugin => {
  const logger = createLogger("info", {
    prefix: "[vite-image-to-avif-plugin]",
  });
  const cacheFilePath = path.resolve(cacheDir, "image-mtimes.json");

  // Resolve output directory path
  const resolvedOutputDir = path.isAbsolute(outputDir)
    ? outputDir
    : path.resolve(process.cwd(), outputDir);

  // Image extensions pattern
  const imageExtensionsPattern = new RegExp(
    `\\.(${imageExtensions.join("|")})$`,
    "i"
  );

  /**
   * Function to load the cache
   *
   * @returns {Promise<ImageCache>} - Returns the cache object with file mtimes
   */
  const loadCache = async (): Promise<ImageCache> => {
    try {
      const data = await fs.readFile(cacheFilePath, "utf-8");
      return JSON.parse(data);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        logger.error(`Failed to load cache: ${(error as Error).message}`);
      }
      return {};
    }
  };

  /**
   * Function to save the cache
   *
   * @param {ImageCache} cache - The map of file paths and their mtimes
   * @returns {Promise<void>}
   */
  const saveCache = async (cache: ImageCache): Promise<void> => {
    await fs.mkdir(path.dirname(cacheFilePath), { recursive: true });
    await fs.writeFile(cacheFilePath, JSON.stringify(cache, null, 2));
  };

  /**
   * Function to calculate the mtime of a file
   *
   * @param {string} filePath - File path for which to calculate the mtime
   * @returns {Promise<number>} - Returns the mtime of the file
   */
  const getFileMtime = async (filePath: string): Promise<number> => {
    const stats = await fs.stat(filePath);
    return stats.mtimeMs;
  };

  /**
   * Function to recursively search directories for image files
   *
   * @param {string} dir - The directory to search
   * @returns {Promise<string[]>} - Returns an array of image file paths
   */
  const getAllImageFiles = async (dir: string): Promise<string[]> => {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      dirents.map(async (dirent) => {
        const res = path.resolve(dir, dirent.name);

        if (dirent.isDirectory()) {
          return getAllImageFiles(res);
        } else if (imageExtensionsPattern.test(dirent.name)) {
          return res;
        }

        return null;
      })
    );

    return files.flat().filter((file): file is string => file !== null);
  };

  /**
   * Function to convert an image to AVIF format
   *
   * @param {string} filePath - The image file path to convert
   * @param {string} outputDir - The directory where the converted AVIF file will be saved
   * @param {number} quality - The quality setting for AVIF conversion
   * @param {ImageCache} cache - The cache of converted files
   * @returns {Promise<void>}
   */
  const convertImageToAvif = async (
    filePath: string,
    outputDir: string,
    quality: number,
    cache: ImageCache
  ): Promise<void> => {
    const normalizedFilePath = path.normalize(filePath);
    const fileMtime = await getFileMtime(normalizedFilePath);
    const cachedMtime = cache[normalizedFilePath];

    if (cachedMtime === fileMtime) {
      logger.info(`Skipping: ${normalizedFilePath} is already converted`);
      return;
    }

    // Generate output path while preserving directory structure
    const relativePath = preserveStructure
      ? path.relative(process.cwd(), filePath)
      : path.basename(filePath);
    const avifFilePath = path.resolve(outputDir, `${relativePath}.avif`);

    try {
      await fs.mkdir(path.dirname(avifFilePath), { recursive: true });
      await sharp(filePath).avif({ quality }).toFile(avifFilePath);

      logger.info(`Converted: ${avifFilePath}`);
      cache[normalizedFilePath] = fileMtime;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        `Failed to convert ${filePath} to AVIF format: ${errorMessage}`
      );
    }
  };

  return {
    name: "vite-image-to-avif-plugin",
    enforce: "post",

    /**
     * Runs image conversion to AVIF format at the end of the build process
     *
     * @returns {Promise<void>}
     */
    async buildEnd(): Promise<void> {
      const cache = await loadCache();
      const limit = pLimit(concurrency); // Limit the number of concurrent image conversions

      for (const rootDir of sourcePaths) {
        const imgDir = path.resolve(process.cwd(), rootDir);
        const allImageFiles = await getAllImageFiles(imgDir);

        const results = await Promise.allSettled(
          allImageFiles.map((filePath) =>
            limit(() =>
              convertImageToAvif(filePath, resolvedOutputDir, quality, cache)
            )
          )
        );

        results.forEach((result) => {
          if (result.status === "rejected") {
            logger.error(`Error processing a file: ${result.reason}`);
          }
        });
      }

      await saveCache(cache);
    },
  };
};

export { viteImageToAVIFPlugin };
