import waygate from '../../index.js';
import { argv } from '../../utils.js';

const rootDir = argv[2];

(async () => {

  const listener = await waygate.listen({
    serverDomain: 'waygate.io',
  });

  const dirTree = await waygate.openDirectory(rootDir);
  const handler = waygate.directoryTreeHandler(dirTree)

  console.log(`Serving ${rootDir} at https://${listener.getDomain()}`);

  waygate.serve(listener, handler);
})();
