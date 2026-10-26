import { SafeScreen } from '../components/SafeScreen';
import { MapPicker } from '../components/MapPicker';
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowLeft, Check, MapPin, Plus, Trash2, Home, Briefcase, Tag } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useApp, SavedAddress } from '../store/app';
import { ensureAndGetLocation } from '../services/location';

type Props = {
  onClose: () => void;
};

const LABELS = [
  { key: 'Home', icon: Home },
  { key: 'Office', icon: Briefcase },
  { key: 'Other', icon: Tag },
];

type Step = 'list' | 'label' | 'map' | 'address';

export function AddressScreen({ onClose }: Props) {
  const { colors, isDark } = useTheme();
  const saved = useApp((s) => s.savedAddresses);
  const selectedId = useApp((s) => s.selectedAddressId);
  const currentLoc = useApp((s) => s.location);
  const addAddr = useApp((s) => s.addSavedAddress);
  const removeAddr = useApp((s) => s.removeSavedAddress);
  const selectAddr = useApp((s) => s.selectAddress);

  const [step, setStep] = useState<Step>('list');
  const [draftLabel, setDraftLabel] = useState('Home');
  const [draftAddress, setDraftAddress] = useState('');
  const [draftLocation, setDraftLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locBusy, setLocBusy] = useState(false);

  // Auto-fetch current location when starting to add
  async function startAdd() {
    setDraftLabel('Home');
    setDraftAddress('');
    setDraftLocation(null);
    setStep('label');

    // Auto-fetch current location in background
    setLocBusy(true);
    const loc = await ensureAndGetLocation();
    setLocBusy(false);
    if (loc) {
      setDraftLocation(loc);
    }
  }

  function goToMap() {
    setStep('map');
  }

  function handleMapConfirm(loc: { lat: number; lng: number }) {
    setDraftLocation(loc);
    setStep('address');
  }

  function saveAddress() {
    if (!draftAddress.trim() || !draftLocation) return;
    const id = `addr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newAddr: SavedAddress = {
      id,
      label: draftLabel,
      address: draftAddress.trim(),
      location: draftLocation,
    };
    addAddr(newAddr);
    selectAddr(id);
    setStep('list');
  }

  // ──── LIST VIEW ────
  if (step === 'list') {
    return (
      <SafeScreen style={[styles.root, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Service Address</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {saved.length === 0 ? (
            <View style={styles.emptyState}>
              <MapPin size={48} color={isDark ? '#334155' : '#cbd5e1'} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No saved addresses yet.{'\n'}Add your first address below.
              </Text>
            </View>
          ) : (
            saved.map((addr) => {
              const isSelected = addr.id === selectedId;
              const LabelIcon = LABELS.find((l) => l.key === addr.label)?.icon || Tag;
              return (
                <TouchableOpacity
                  key={addr.id}
                  style={[
                    styles.addrCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: isSelected ? (isDark ? '#818cf8' : '#4f46e5') : colors.cardBorder,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                  onPress={() => selectAddr(addr.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.addrIcon, { backgroundColor: isSelected ? (isDark ? '#312e81' : '#eef2ff') : (isDark ? '#1e293b' : '#f8fafc') }]}>
                    <LabelIcon size={20} color={isSelected ? (isDark ? '#818cf8' : '#4f46e5') : colors.textMuted} />
                  </View>
                  <View style={styles.addrInfo}>
                    <View style={styles.addrLabelRow}>
                      <Text style={[styles.addrLabel, { color: colors.text }]}>{addr.label}</Text>
                      {isSelected && (
                        <View style={[styles.defaultBadge, { backgroundColor: isDark ? '#312e81' : '#eef2ff' }]}>
                          <Text style={[styles.defaultText, { color: isDark ? '#818cf8' : '#4f46e5' }]}>Default</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.addrText, { color: colors.textMuted }]} numberOfLines={2}>{addr.address}</Text>
                    {addr.location && (
                      <Text style={[styles.addrCoords, { color: colors.textFaint }]}>
                        {addr.location.lat.toFixed(4)}, {addr.location.lng.toFixed(4)}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => removeAddr(addr.id)}
                    style={styles.deleteBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Trash2 size={16} color={isDark ? '#f87171' : '#dc2626'} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        <View style={[styles.bottomBar, { backgroundColor: colors.bg }]}>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: '#4f46e5' }]}
            onPress={startAdd}
            activeOpacity={0.8}
          >
            <Plus size={20} color="#fff" strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Add Address</Text>
          </TouchableOpacity>
        </View>
      </SafeScreen>
    );
  }

  // ──── STEP 1: PICK LABEL ────
  if (step === 'label') {
    return (
      <SafeScreen style={[styles.root, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('list')} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>New Address</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.stepContent}>
          <Text style={[styles.stepTitle, { color: colors.text }]}>What's this address for?</Text>
          <Text style={[styles.stepSub, { color: colors.textMuted }]}>Pick a label to identify this address</Text>

          <View style={styles.labelGrid}>
            {LABELS.map((l) => {
              const active = draftLabel === l.key;
              const Icon = l.icon;
              return (
                <TouchableOpacity
                  key={l.key}
                  style={[
                    styles.labelCardBig,
                    {
                      backgroundColor: active ? (isDark ? '#312e81' : '#eef2ff') : colors.card,
                      borderColor: active ? (isDark ? '#818cf8' : '#4f46e5') : colors.cardBorder,
                    },
                  ]}
                  onPress={() => setDraftLabel(l.key)}
                  activeOpacity={0.7}
                >
                  <Icon size={28} color={active ? (isDark ? '#818cf8' : '#4f46e5') : colors.textMuted} />
                  <Text style={[styles.labelCardText, { color: active ? (isDark ? '#818cf8' : '#4f46e5') : colors.text }]}>
                    {l.key}
                  </Text>
                  {active && <Check size={18} color="#22c55e" style={{ position: 'absolute', top: 12, right: 12 }} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {locBusy && (
            <View style={styles.locLoadingRow}>
              <ActivityIndicator color={isDark ? '#818cf8' : '#4f46e5'} size={14} />
              <Text style={[styles.locLoadingText, { color: colors.textMuted }]}>Getting your location...</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: '#4f46e5' }]}
            onPress={goToMap}
            activeOpacity={0.8}
          >
            <Text style={styles.nextBtnText}>Next — Pick Location on Map</Text>
          </TouchableOpacity>
        </View>
      </SafeScreen>
    );
  }

  // ──── STEP 2: MAP PIN ────
  if (step === 'map') {
    return (
      <SafeScreen style={[styles.root, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('label')} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Pin Location</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={[styles.mapHint, { color: colors.textMuted }]}>
          Move the map to place the pin on your exact location
        </Text>

        <View style={{ flex: 1, padding: 12 }}>
          <MapPicker
            initial={draftLocation || currentLoc}
            onConfirm={handleMapConfirm}
            onCancel={() => setStep('label')}
            height={undefined}
          />
        </View>
      </SafeScreen>
    );
  }

  // ──── STEP 3: TEXT ADDRESS ────
  return (
    <SafeScreen style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setStep('map')} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Enter Address</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.stepContent}>
        <View style={[styles.locConfirmed, { backgroundColor: isDark ? '#1e1b4b' : '#eef2ff' }]}>
          <MapPin size={18} color={isDark ? '#818cf8' : '#4f46e5'} />
          <Text style={[styles.locConfirmedText, { color: isDark ? '#c7d2fe' : '#4338ca' }]}>
            {draftLocation?.lat.toFixed(5)}, {draftLocation?.lng.toFixed(5)}
          </Text>
        </View>

        <Text style={[styles.stepTitle, { color: colors.text, marginTop: 24 }]}>Full text address</Text>
        <Text style={[styles.stepSub, { color: colors.textMuted }]}>
          e.g. Flat 302, Sunrise Apartments,
          Near City Hospital, Sector 17
        </Text>

        <TextInput
          value={draftAddress}
          onChangeText={setDraftAddress}
          placeholder="Enter your complete address..."
          placeholderTextColor={colors.textFaint}
          style={[styles.addrInputBig, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
          multiline
          autoFocus
        />

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: draftAddress.trim() ? '#4f46e5' : (isDark ? '#374151' : '#d1d5db') }]}
          onPress={saveAddress}
          disabled={!draftAddress.trim()}
          activeOpacity={0.8}
        >
          <Check size={20} color="#fff" strokeWidth={3} />
          <Text style={styles.saveBtnText}>Save Address</Text>
        </TouchableOpacity>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  scroll: { padding: 16, paddingBottom: 100 },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 16 },
  emptyText: { fontSize: 16, textAlign: 'center', lineHeight: 24 },

  addrCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
  },
  addrIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  addrInfo: { flex: 1 },
  addrLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addrLabel: { fontSize: 16, fontWeight: '800' },
  defaultBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  defaultText: { fontSize: 11, fontWeight: '700' },
  addrText: { fontSize: 13, fontWeight: '500', marginTop: 4, lineHeight: 18 },
  addrCoords: { fontSize: 11, marginTop: 2 },
  deleteBtn: { padding: 8 },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },

  // Step screens
  stepContent: { flex: 1, padding: 20 },
  stepTitle: { fontSize: 22, fontWeight: '800' },
  stepSub: { fontSize: 15, marginTop: 6, lineHeight: 22 },

  labelGrid: { flexDirection: 'row', gap: 12, marginTop: 24 },
  labelCardBig: {
    flex: 1,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
    gap: 10,
    position: 'relative',
  },
  labelCardText: { fontSize: 15, fontWeight: '800' },

  locLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    marginTop: 20,
  },
  locLoadingText: { fontSize: 14 },

  nextBtn: {
    marginTop: 'auto',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  nextBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },

  mapHint: { textAlign: 'center', fontSize: 14, paddingHorizontal: 20, marginBottom: 4 },

  locConfirmed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  locConfirmedText: { fontSize: 14, fontWeight: '700' },

  addrInputBig: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    fontSize: 17,
    minHeight: 100,
    textAlignVertical: 'top',
    marginTop: 16,
  },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 'auto',
    paddingVertical: 18,
    borderRadius: 16,
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
