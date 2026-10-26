import React, { useRef, useMemo, useCallback, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../theme/ThemeContext';
import { Check, Layers, X } from 'lucide-react-native';

type LatLng = { lat: number; lng: number };

type Props = {
  /** Initial center. If null, defaults to India center */
  initial?: LatLng | null;
  /** Called when user confirms pin location */
  onConfirm: (loc: LatLng) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Height of the map */
  height?: number;
};

/**
 * Draggable-pin map picker using Leaflet WebView.
 * Auto-centers on `initial` location. User drags map under pin, then taps Confirm.
 */
export function MapPicker({ initial, onConfirm, onCancel, height }: Props) {
  const { isDark } = useTheme();
  const ref = useRef<WebView>(null);
  const latRef = useRef(initial?.lat ?? 28.6139);
  const lngRef = useRef(initial?.lng ?? 77.209);
  const [isSatellite, setIsSatellite] = useState(false);

  const cartoKey = 'cb1_4ush_1_c2b57816092c02613d9e2bef';
  const tileStandard = isDark
    ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${cartoKey}`
    : `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${cartoKey}`;
  const tileSatellite = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

  const html = useMemo(() => `
<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:${isDark ? '#1a1a2e' : '#f0f4f8'}}
  .leaflet-div-icon{background:none!important;border:none!important}
  .leaflet-marker-shadow{display:none!important}
  .leaflet-marker-icon{background:none!important;border:none!important}
  .leaflet-control-zoom{display:none!important}
  .center-cross{position:absolute;top:50%;left:50%;transform:translate(-50%,-100%);z-index:999;pointer-events:none}
  .pin-circle{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#7c3aed);border:3px solid #fff;box-shadow:0 4px 20px rgba(79,70,229,0.5);display:flex;align-items:center;justify-content:center}
  .pin-circle svg{width:22px;height:22px}
  .pin-stem{width:3px;height:14px;background:#4f46e5;margin:0 auto;border-radius:0 0 2px 2px}
  .pin-shadow{width:20px;height:6px;background:rgba(0,0,0,0.15);border-radius:50%;margin:-2px auto 0}
  .addr-bar{position:absolute;bottom:12px;left:12px;right:12px;background:${isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)'};border-radius:14px;padding:12px 16px;z-index:999;font-family:-apple-system,sans-serif;box-shadow:0 2px 12px rgba(0,0,0,0.12)}
  .addr-bar .coords{font-size:13px;color:${isDark ? '#94a3b8' : '#64748b'};font-weight:600}
  .addr-bar .hint{font-size:11px;color:${isDark ? '#64748b' : '#94a3b8'};margin-top:2px}
</style>
</head><body>
<div id="map"></div>
<div class="center-cross">
  <div class="pin-circle">
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  </div>
  <div class="pin-stem"></div>
  <div class="pin-shadow"></div>
</div>
<div class="addr-bar">
  <div class="coords" id="coords">${(initial?.lat ?? 28.6139).toFixed(6)}, ${(initial?.lng ?? 77.209).toFixed(6)}</div>
  <div class="hint">Drag the map to move the pin</div>
</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  var lat = ${initial?.lat ?? 28.6139};
  var lng = ${initial?.lng ?? 77.209};
  var map = L.map('map', {
    zoomControl: false,
    attributionControl: false
  }).setView([lat, lng], 16);

  var standardTile = L.tileLayer('${tileStandard}', { maxZoom: 19, subdomains: 'abcd' });
  var satelliteTile = L.tileLayer('${tileSatellite}', { maxZoom: 19 });
  standardTile.addTo(map);

  window.switchToSatellite = function() {
    map.removeLayer(standardTile);
    satelliteTile.addTo(map);
  };
  window.switchToStandard = function() {
    map.removeLayer(satelliteTile);
    standardTile.addTo(map);
  };

  function updateCoords() {
    var c = map.getCenter();
    document.getElementById('coords').textContent = c.lat.toFixed(6) + ', ' + c.lng.toFixed(6);
    window.ReactNativeWebView.postMessage(JSON.stringify({ lat: c.lat, lng: c.lng }));
  }

  map.on('moveend', updateCoords);
})();
</script>
</body></html>
`, [isDark, initial?.lat, initial?.lng, tileStandard, tileSatellite]);

  const onMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.lat && data.lng) {
        latRef.current = data.lat;
        lngRef.current = data.lng;
      }
    } catch {}
  }, []);

  function toggleMapStyle() {
    const next = !isSatellite;
    setIsSatellite(next);
    ref.current?.injectJavaScript(
      next ? 'window.switchToSatellite(); true;' : 'window.switchToStandard(); true;'
    );
  }

  return (
    <View style={[styles.wrap, height ? { height } : { flex: 1 }]}>
      <WebView
        ref={ref}
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        overScrollMode="never"
      />
      {/* Top controls */}
      <View style={styles.topRow}>
        <TouchableOpacity
          style={[styles.btn, styles.cancelBtn]}
          onPress={onCancel}
          activeOpacity={0.7}
        >
          <X size={16} color="#64748b" />
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.mapToggle, isSatellite && styles.mapToggleActive]}
          onPress={toggleMapStyle}
          activeOpacity={0.7}
        >
          <Layers size={16} color={isSatellite ? '#fff' : '#64748b'} />
          <Text style={[styles.toggleText, isSatellite && { color: '#fff' }]}>
            {isSatellite ? 'Standard' : 'Satellite'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.confirmBtn]}
          onPress={() => onConfirm({ lat: latRef.current, lng: lngRef.current })}
          activeOpacity={0.8}
        >
          <Check size={18} color="#fff" strokeWidth={3} />
          <Text style={styles.confirmText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 18, overflow: 'hidden', position: 'relative' },
  webview: { flex: 1, borderRadius: 18 },
  topRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    position: 'absolute',
    top: 8,
    right: 8,
    left: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  mapToggle: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  mapToggleActive: {
    backgroundColor: 'rgba(79,70,229,0.9)',
  },
  toggleText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  confirmBtn: {
    backgroundColor: '#4f46e5',
    flex: 1,
  },
  cancelText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  confirmText: { fontSize: 13, fontWeight: '800', color: '#fff' },
});
