const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);
const localPreview = process.env.EXPO_PUBLIC_LOCAL_PREVIEW === "1";
const clerkExpoMock = path.resolve(__dirname, "mocks/clerk-expo.tsx");
const clerkTokenCacheMock = path.resolve(__dirname, "mocks/clerk-token-cache.ts");

// Block Metro from watching Clerk's temp build directories and agent temp dirs
const blockList = [
  /node_modules\/.pnpm\/@clerk\+backend[^/]*\/node_modules\/@clerk\/backend_tmp_\d+\//,
  /[/\\]\.local[/\\]/,
];

config.resolver = {
  ...config.resolver,
  ...(localPreview
    ? {
        extraNodeModules: {
          ...config.resolver.extraNodeModules,
          "@clerk/expo": clerkExpoMock,
          "@clerk/expo/token-cache": clerkTokenCacheMock,
        },
        resolveRequest: (context, moduleName, platform) => {
          if (moduleName === "@clerk/expo") {
            return { type: "sourceFile", filePath: clerkExpoMock };
          }
          if (moduleName === "@clerk/expo/token-cache") {
            return { type: "sourceFile", filePath: clerkTokenCacheMock };
          }
          return context.resolveRequest(context, moduleName, platform);
        },
      }
    : {}),
  blockList: [
    ...(config.resolver.blockList
      ? Array.isArray(config.resolver.blockList)
        ? config.resolver.blockList
        : [config.resolver.blockList]
      : []),
    ...blockList,
  ],
};

// Preserve Expo defaults and include only this workspace root.
config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(__dirname, ".."),
];

module.exports = config;
