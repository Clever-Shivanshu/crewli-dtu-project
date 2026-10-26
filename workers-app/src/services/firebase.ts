import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken as _getToken,
  onMessage as _onMessage,
  onTokenRefresh as _onTokenRefresh,
  requestPermission as _requestPermission,
  setBackgroundMessageHandler as _setBackgroundMessageHandler,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';

export const fbMessaging = getMessaging(getApp());

export const fbGetToken = () => _getToken(fbMessaging);
export const fbOnMessage = (cb: Parameters<typeof _onMessage>[1]) =>
  _onMessage(fbMessaging, cb);
export const fbOnTokenRefresh = (cb: Parameters<typeof _onTokenRefresh>[1]) =>
  _onTokenRefresh(fbMessaging, cb);
export const fbRequestPermission = () => _requestPermission(fbMessaging);
export const fbSetBackgroundMessageHandler = (
  cb: Parameters<typeof _setBackgroundMessageHandler>[1]
) => _setBackgroundMessageHandler(fbMessaging, cb);

export { AuthorizationStatus };
