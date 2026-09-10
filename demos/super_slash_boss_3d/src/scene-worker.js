import { staticRegion, indexScene } from './scene.js';
self.onmessage = event => {
  const region = event.data.region;
  self.postMessage({ region, tree: indexScene(staticRegion(region)) });
};
