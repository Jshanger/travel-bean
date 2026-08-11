const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MODULAR_HEADERS_DIRECTIVE = 'use_modular_headers!';

function addModularHeadersToPodfile(contents) {
  if (contents.includes(MODULAR_HEADERS_DIRECTIVE)) {
    return contents;
  }

  const platformMatch = contents.match(/^platform :ios,.*$/m);
  if (platformMatch) {
    return contents.replace(
      platformMatch[0],
      `${platformMatch[0]}\n${MODULAR_HEADERS_DIRECTIVE}`
    );
  }

  return `${MODULAR_HEADERS_DIRECTIVE}\n${contents}`;
}

module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      const podfile = fs.readFileSync(podfilePath, 'utf8');
      fs.writeFileSync(podfilePath, addModularHeadersToPodfile(podfile));
      return config;
    },
  ]);
};

