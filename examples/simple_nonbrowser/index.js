import * as waygate from '../../index.js';
import { argv } from '../../utils.js';

const rootDir = argv[2];
const serverUri = argv[3] || 'https://wg1.iobio.io';

(async () => {

  waygate.setServerUri(serverUri);

  const listener = await waygate.listen({
    tunnelType: 'websocket',
  });

  const dirTree = await waygate.openDirectory(rootDir);
  const handler = waygate.directoryTreeHandler(dirTree)

  console.log(`Serving ${rootDir} at https://${listener.getDomain()}`);

  waygate.serve(listener, handler);
})();
