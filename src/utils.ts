import * as fs from 'fs';

export function loadLifeCycleConfig(configFileLocation: string): string {
  const filePath = configFileLocation;

  if (!filePath) {
    throw new Error('The file path is not defined! Please provide a valid file path.');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`The file "${filePath}" does not exists in "../config" directory!`);
  }
  const lc_file = fs.readFileSync(filePath, { encoding: 'base64' }).toString();
  return lc_file;
}
