import React, { useEffect, useState, useCallback } from 'react';
import {
  AppState,
  NativeModules,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react-native';
import {
  hasLocationPermission,
  requestLocationPermission,
} from '../services/location';

const IncomingJob = NativeModules.IncomingJob as {
  isIgnoringBatteryOptimizations: () => Promise<boolean>;
  requestIgnoreBatteryOptimizations: () => void;
  canUseFullScreenIntent: () => Promise<boolean>;
  requestFullScreenIntentPermission: () => void;
  hasNotificationsEnabled: () => Promise<boolean>;
  openAppNotificationSettings: () => void;
  openAutoStartSettings: () => void;
  canDrawOverlays: () => Promise<boolean>;
  requestOverlayPermission: () => void;
};

type Status = { battery: boolean; fsi: boolean; notif: boolean; location: boolean; overlay: boolean };

export function SystemStatusCard() {
  const [s, setS] = useState<Status>({ battery: false, fsi: false, notif: false, location: false, overlay: false });
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      const [battery, fsi, notif, location, overlay] = await Promise.all([
        IncomingJob.isIgnoringBatteryOptimizations(),
        IncomingJob.canUseFullScreenIntent(),
        IncomingJob.hasNotificationsEnabled(),
        hasLocationPermission(),
        IncomingJob.canDrawOverlays(),
      ]);
      setS({ battery, fsi, notif, location, overlay });
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const allOk = s.battery && s.fsi && s.notif && s.location && s.overlay;

  // Collapsed pill when everything is OK — no modal, no noise.
  if (allOk && !expanded) {
    return (
      <TouchableOpacity
        style={styles.pill}
        onPress={() => setExpanded(true)}
        activeOpacity={0.7}
      >
        <CheckCircle2 size={16} color="#22c55e" />
        <Text style={styles.pillText}>Device ready</Text>
        <ChevronDown size={14} color="#9ca3af" />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.card, allOk ? styles.cardOk : styles.cardWarn]}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {allOk ? (
            <CheckCircle2 size={18} color="#22c55e" />
          ) : (
            <AlertTriangle size={18} color="#f59e0b" />
          )}
          <Text style={styles.title}>{allOk ? 'Device ready' : 'Action needed'}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={refresh}>
            <Text style={styles.refresh}>Refresh</Text>
          </TouchableOpacity>
          {allOk ? (
            <TouchableOpacity onPress={() => setExpanded(false)}>
              <ChevronUp size={18} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {!allOk && (
        <Text style={styles.sub}>
          Grant these so job offers reach you even when the phone is locked or idle.
        </Text>
      )}

      <Item
        label="Location"
        ok={s.location}
        badText="Blocked — we cannot match you with nearby jobs"
        onFix={async () => {
          await requestLocationPermission();
          setTimeout(refresh, 800);
        }}
      />
      <Item
        label="Battery optimization"
        ok={s.battery}
        badText="Enabled — app may be killed"
        onFix={() => {
          IncomingJob.requestIgnoreBatteryOptimizations();
          setTimeout(refresh, 1500);
        }}
      />
      <Item
        label="Full-screen notifications"
        ok={s.fsi}
        badText="Blocked — jobs won't wake the screen"
        onFix={() => {
          IncomingJob.requestFullScreenIntentPermission();
          setTimeout(refresh, 1500);
        }}
      />
      <Item
        label="Notifications"
        ok={s.notif}
        badText="Blocked — you won't see job offers"
        onFix={async () => {
          if (Number(Platform.Version) >= 33) {
            await PermissionsAndroid.request(
              'android.permission.POST_NOTIFICATIONS' as any
            );
          }
          IncomingJob.openAppNotificationSettings();
          setTimeout(refresh, 1500);
        }}
      />
      <Item
        label="Display over other apps"
        ok={s.overlay}
        badText="Blocked — jobs won't pop up"
        onFix={() => {
          IncomingJob.requestOverlayPermission();
          setTimeout(refresh, 1500);
        }}
      />

      {!allOk ? (
        <TouchableOpacity
          style={styles.autostart}
          onPress={() => IncomingJob.openAutoStartSettings()}
        >
          <Text style={styles.autostartText}>
            Also enable "Auto-start" / "Background run" on your phone
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Item(props: { label: string; ok: boolean; badText: string; onFix: () => void }) {
  return (
    <View style={styles.item}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemLabel}>{props.label}</Text>
        <View style={styles.statusRow}>
          {props.ok ? (
            <CheckCircle2 size={12} color="#22c55e" />
          ) : (
            <AlertTriangle size={12} color="#f59e0b" />
          )}
          <Text style={[styles.itemStatus, { color: props.ok ? '#22c55e' : '#f59e0b' }]}>
            {props.ok ? 'Allowed' : props.badText}
          </Text>
        </View>
      </View>
      {!props.ok && (
        <TouchableOpacity style={styles.fixBtn} onPress={props.onFix}>
          <Text style={styles.fixBtnText}>Fix</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#052e1a',
    borderWidth: 1,
    borderColor: '#166534',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 16,
  },
  pillText: { color: '#d1fae5', fontSize: 13, fontWeight: '600' },
  card: {
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
  },
  cardOk: { backgroundColor: '#052e1a', borderColor: '#166534' },
  cardWarn: { backgroundColor: '#1f1608', borderColor: '#92400e' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  refresh: { color: '#60a5fa', fontSize: 13 },
  sub: { color: '#d1d5db', fontSize: 12, marginTop: 6 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    marginTop: 8,
  },
  itemLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  itemStatus: { fontSize: 12 },
  fixBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  fixBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  autostart: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  autostartText: { color: '#60a5fa', fontSize: 12 },
});
