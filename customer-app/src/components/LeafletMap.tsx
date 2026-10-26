import React, { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../theme/ThemeContext';
import { Layers } from 'lucide-react-native';

type LatLng = { lat: number; lng: number };

interface LeafletMapProps {
  worker: LatLng | null;
  customer: LatLng | null;
  style?: StyleProp<ViewStyle>;
};

export type LeafletMapRef = {
  focusCurrentLocation: () => void;
};

const CARTO_KEY = 'cb1_4ush_1_c2b57816092c02613d9e2bef';
const TILES = {
  voyager: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`,
  dark: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`,
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

const HTML_TEMPLATE = (isDark: boolean) => {
  const defaultTile = isDark ? TILES.dark : TILES.voyager;

  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:${isDark ? '#1a1a2e' : '#f0f4f8'}}
  .leaflet-div-icon{background:none!important;border:none!important}
  .leaflet-marker-shadow{display:none!important}
  .leaflet-marker-icon{background:none!important;border:none!important}
  img.leaflet-marker-shadow{display:none!important}
  .leaflet-control-zoom{border:none!important;box-shadow:0 2px 12px rgba(0,0,0,0.15)!important;border-radius:12px!important;overflow:hidden;margin-top:48px!important}
  .leaflet-control-zoom a{background:${isDark ? '#1e293b' : '#fff'}!important;color:${isDark ? '#e2e8f0' : '#334155'}!important;border:none!important;width:36px!important;height:36px!important;line-height:36px!important;font-size:18px!important}
  .leaflet-control-zoom a:hover{background:${isDark ? '#334155' : '#f1f5f9'}!important}
  .pulse-ring{position:relative}
  .pulse-ring::after{content:'';position:absolute;border-radius:50%;animation:pulse 2s ease-out infinite}
  .worker-pin .pulse-ring::after{top:-10px;left:-10px;width:60px;height:60px;background:rgba(37,99,235,0.2)}
  .customer-pin .pulse-ring::after{top:-8px;left:-8px;width:44px;height:44px;background:rgba(239,68,68,0.2)}
  @keyframes pulse{0%{transform:scale(1);opacity:0.7}100%{transform:scale(2.5);opacity:0}}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  // Kill Leaflet's default blue marker icon completely
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: '',
    iconRetinaUrl: '',
    shadowUrl: ''
  });

  var map = L.map('map', {
    zoomControl: false,
    attributionControl: false,
    zoomAnimation: true,
    markerZoomAnimation: true
  }).setView([20.5937, 78.9629], 5);

  L.control.zoom({ position: 'topright' }).addTo(map);

  var currentLayer = L.tileLayer('${defaultTile}', { maxZoom: 19, subdomains: 'abcd' }).addTo(map);

  // Tile switching
  window.switchTile = function(url) {
    map.removeLayer(currentLayer);
    currentLayer = L.tileLayer(url, { maxZoom: 19, subdomains: 'abcd' }).addTo(map);
  };

  // Focus on current points
  window.focusBounds = function() {
    if (wMarker && cMarker) {
      map.fitBounds(L.latLngBounds([wMarker.getLatLng(), cMarker.getLatLng()]), { padding: [60,60], maxZoom: 16 });
    } else if (cMarker) {
      map.setView(cMarker.getLatLng(), 15);
    } else if (wMarker) {
      map.setView(wMarker.getLatLng(), 15);
    }
  };

  var workerIcon = L.divIcon({
    className: 'worker-pin',
    html: '<div class="pulse-ring" style="width:40px;height:40px"><div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#1d4ed8);border:3px solid #fff;box-shadow:0 3px 14px rgba(37,99,235,0.5);display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div></div>',
    iconSize: [40,40],
    iconAnchor: [20,20]
  });

  var customerIcon = L.divIcon({
    className: 'customer-pin',
    html: '<div class="pulse-ring"><div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#ef4444,#dc2626);border:3px solid #fff;box-shadow:0 3px 14px rgba(239,68,68,0.5);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" stroke="none"><circle cx="12" cy="12" r="4"/></svg></div></div>',
    iconSize: [28,28],
    iconAnchor: [14,14]
  });

  var wMarker = null, cMarker = null, routeLine = null, shadowLine = null, fittedOnce = false;
  var lastRouteKey = '';

  function setPoints(w, c) {
    if (w) {
      if (!wMarker) wMarker = L.marker([w.lat,w.lng], { icon: workerIcon }).addTo(map);
      else wMarker.setLatLng([w.lat,w.lng]);
    }
    if (c) {
      if (!cMarker) cMarker = L.marker([c.lat,c.lng], { icon: customerIcon }).addTo(map);
      else cMarker.setLatLng([c.lat,c.lng]);
    }
    if (w && c) {
      var routeKey = w.lat.toFixed(3)+','+w.lng.toFixed(3)+';'+c.lat.toFixed(3)+','+c.lng.toFixed(3);
      if (routeKey === lastRouteKey) return;
      lastRouteKey = routeKey;

      fetch('https://router.project-osrm.org/route/v1/driving/'+w.lng+','+w.lat+';'+c.lng+','+c.lat+'?overview=full&geometries=geojson')
        .then(function(res){ return res.json(); })
        .then(function(data){
          if (shadowLine) shadowLine.remove();
          if (routeLine) routeLine.remove();
          if (data.routes && data.routes.length > 0) {
            var coords = data.routes[0].geometry.coordinates.map(function(c){ return [c[1],c[0]]; });
            shadowLine = L.polyline(coords, {
              color: '${isDark ? '#1e293b' : '#94a3b8'}',
              weight: 8, opacity: 0.3, lineCap: 'round', lineJoin: 'round'
            }).addTo(map);
            routeLine = L.polyline(coords, {
              color: '${isDark ? '#818cf8' : '#4f46e5'}',
              weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round'
            }).addTo(map);
            if (!fittedOnce) {
              map.fitBounds(routeLine.getBounds(), { padding: [60,60], maxZoom: 16 });
              fittedOnce = true;
            }
          }
        })
        .catch(function(){
          if (routeLine) routeLine.remove();
          routeLine = L.polyline([[w.lat,w.lng],[c.lat,c.lng]], {
            color: '${isDark ? '#818cf8' : '#4f46e5'}',
            weight: 4, opacity: 0.7, dashArray: '10,8', lineCap: 'round'
          }).addTo(map);
        });
    } else if (w) {
      map.setView([w.lat,w.lng], 15);
    } else if (c) {
      map.setView([c.lat,c.lng], 15);
    }
  }

  window.setPoints = setPoints;
  function onMsg(raw){
    try { var d = JSON.parse(raw); if (d && d.points) setPoints(d.points.w, d.points.c); } catch(_){}
  }
  document.addEventListener('message', function(e){ onMsg(e.data); });
  window.addEventListener('message', function(e){ onMsg(e.data); });
})();
</script>
</body></html>`;
};

export const LeafletMap = forwardRef<LeafletMapRef, LeafletMapProps>(function LeafletMap({ worker, customer, style }, ref) {
  const webViewRef = useRef<WebView>(null);
  const { isDark } = useTheme();
  const [tileMode, setTileMode] = useState<'default' | 'satellite'>('default');

  useImperativeHandle(ref, () => ({
    focusCurrentLocation: () => {
      webViewRef.current?.injectJavaScript(
        `(function(){ try { window.focusBounds(); } catch(e) {} true; })();`
      );
    },
  }));

  useEffect(() => {
    webViewRef.current?.injectJavaScript(
      `(function(){ try { window.setPoints(${JSON.stringify(worker)}, ${JSON.stringify(customer)}); } catch(e) {} true; })();`
    );
  }, [worker?.lat, worker?.lng, customer?.lat, customer?.lng]);

  const source = useMemo(() => ({ html: HTML_TEMPLATE(isDark) }), [isDark]);

  function toggleTile() {
    const next = tileMode === 'default' ? 'satellite' : 'default';
    setTileMode(next);
    const url = next === 'satellite'
      ? TILES.satellite
      : (isDark ? TILES.dark : TILES.voyager);
    webViewRef.current?.injectJavaScript(`(function(){ try { window.switchTile('${url}'); } catch(e){} true; })();`);
  }

  return (
    <View style={[styles.wrap, { backgroundColor: isDark ? '#1a1a2e' : '#f0f4f8' }, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={source}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        onLoadEnd={() => {
          webViewRef.current?.injectJavaScript(
            `(function(){ 
              try { 
                window.setPoints(${JSON.stringify(worker)}, ${JSON.stringify(customer)});
              } catch(e){} 
              true; 
            })();`
          );
        }}
        style={{ backgroundColor: 'transparent' }}
      />

      {/* Satellite / Normal toggle */}
      <TouchableOpacity
        onPress={toggleTile}
        style={[styles.tileBtn, { backgroundColor: isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.95)' }]}
        activeOpacity={0.8}
      >
        <Layers size={18} color={isDark ? '#818cf8' : '#4f46e5'} strokeWidth={2.5} />
        <Text style={[styles.tileBtnText, { color: isDark ? '#cbd5e1' : '#334155' }]}>
          {tileMode === 'default' ? 'Satellite' : 'Map'}
        </Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  tileBtn: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  tileBtnText: { fontSize: 13, fontWeight: '700' },
});
