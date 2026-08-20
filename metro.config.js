const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
};
config.resolver = {
  ...config.resolver,
  sourceExts: [...config.resolver.sourceExts, 'svg'],
  assetExts: config.resolver.assetExts.filter((ext) => ext !== 'svg'),
};

module.exports = config;