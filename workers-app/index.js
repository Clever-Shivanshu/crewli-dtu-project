import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';
import { fbSetBackgroundMessageHandler } from './src/services/firebase';
import { handleBackgroundJobMessage } from './src/services/fcmHandler';

// Background/killed FCM handler. MUST be registered before AppRegistry.
fbSetBackgroundMessageHandler(async (remoteMessage) => {
  await handleBackgroundJobMessage(remoteMessage);
});

AppRegistry.registerComponent(appName, () => App);
