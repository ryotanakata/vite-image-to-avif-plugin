import { describe, it, expect, vi, beforeEach } from "vitest";
import { viteImageToAVIFPlugin } from "./index";
import { promises as fs, Dirent, Stats } from "fs";
import path from "path";
import sharp from "sharp";
import type { Plugin } from "vite";

// Using Vitest mock features
vi.mock("fs", () => ({
  promises: {
    readdir: vi.fn(),
    stat: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
  },
}));

vi.mock("sharp", () => {
  return {
    default: vi.fn(() => ({
      avif: vi.fn(() => ({
        toFile: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  };
});

describe("viteImageToAVIFPlugin", () => {
  let plugin: Plugin;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up basic file system mocks
    vi.mocked(fs.readFile).mockResolvedValue("{}");
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  });

  it("creates plugin with correct structure", () => {
    plugin = viteImageToAVIFPlugin({});
    expect(plugin).toMatchObject({
      name: "vite-image-to-avif-plugin",
      enforce: "post",
      buildEnd: expect.any(Function),
    });
  });

  it("uses default options when none provided", () => {
    plugin = viteImageToAVIFPlugin({});
    expect(plugin.name).toBe("vite-image-to-avif-plugin");
    // Verifying default options
    expect(vi.mocked(sharp).mock.calls[0]).toBeUndefined();
  });

  it("handles custom quality setting", async () => {
    plugin = viteImageToAVIFPlugin({ quality: 90 });
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: "test.png", isDirectory: () => false } as Dirent,
    ]);
    vi.mocked(fs.stat).mockResolvedValue({ mtimeMs: Date.now() } as Stats);

    const buildEnd = plugin.buildEnd as () => Promise<void>;
    await buildEnd?.();

    const sharpInstance = vi.mocked(sharp).mock.results[0]?.value;
    expect(sharpInstance.avif).toHaveBeenCalledWith({ quality: 90 });
  });

  it("processes multiple source paths", async () => {
    plugin = viteImageToAVIFPlugin({
      sourcePaths: ["src/images", "public/assets"],
    });

    vi.mocked(fs.readdir).mockResolvedValue([
      { name: "test.png", isDirectory: () => false } as Dirent,
    ]);
    vi.mocked(fs.stat).mockResolvedValue({ mtimeMs: Date.now() } as Stats);

    const buildEnd = plugin.buildEnd as () => Promise<void>;
    await buildEnd?.();

    // Confirm that readdir is called for each source path
    expect(fs.readdir).toHaveBeenCalledTimes(2);
  });

  it("skips non-image files", async () => {
    plugin = viteImageToAVIFPlugin({});

    vi.mocked(fs.readdir).mockResolvedValue([
      { name: "test.txt", isDirectory: () => false } as Dirent,
    ]);

    const buildEnd = plugin.buildEnd as () => Promise<void>;
    await buildEnd?.();

    // Confirm that sharp is not called
    expect(sharp).not.toHaveBeenCalled();
  });

  it("handles cache correctly", async () => {
    plugin = viteImageToAVIFPlugin({});

    const mtime = Date.now();
    const cache = {
      [path.resolve("src/test.png")]: mtime,
    };

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(cache));
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: "test.png", isDirectory: () => false } as Dirent,
    ]);
    vi.mocked(fs.stat).mockResolvedValue({ mtimeMs: mtime } as Stats);

    const buildEnd = plugin.buildEnd as () => Promise<void>;
    await buildEnd?.();

    // Cached files should be skipped
    expect(sharp).not.toHaveBeenCalled();
  });

  it("handles conversion errors gracefully", async () => {
    plugin = viteImageToAVIFPlugin({});

    vi.mocked(fs.readdir).mockResolvedValue([
      { name: "test.png", isDirectory: () => false } as Dirent,
    ]);
    vi.mocked(fs.stat).mockResolvedValue({ mtimeMs: Date.now() } as Stats);

    const error = new Error("Conversion failed");
    vi.mocked(sharp).mockImplementation(() => {
      throw error;
    });

    const buildEnd = plugin.buildEnd as () => Promise<void>;
    // Confirm that errors are handled without being thrown
    await expect(buildEnd?.()).resolves.not.toThrow();
  });

  // Testing concurrency limit
  it("respects concurrency limit", async () => {
    const concurrencyLimit = 2;
    plugin = viteImageToAVIFPlugin({ concurrency: concurrencyLimit });

    // Mock multiple files
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: "test1.png", isDirectory: () => false },
      { name: "test2.png", isDirectory: () => false },
      { name: "test3.png", isDirectory: () => false },
      { name: "test4.png", isDirectory: () => false },
    ] as Dirent[]);
    vi.mocked(fs.stat).mockResolvedValue({ mtimeMs: Date.now() } as Stats);

    const conversion = vi
      .fn()
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );
    vi.mocked(sharp).mockImplementation(
      () =>
        ({
          avif: vi.fn(() => ({
            toFile: conversion,
          })),
        }) as unknown as sharp.Sharp,
    );

    const buildEnd = plugin.buildEnd as () => Promise<void>;
    const start = Date.now();
    await buildEnd?.();
    const duration = Date.now() - start;

    // Confirm that concurrency is limited
    expect(duration).toBeGreaterThan(200); // Two batches of processing (100ms each)
  });
});
