import { SafeScreen } from '../components/SafeScreen';
import { showAlert } from '../store/alert';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  api,
  CachedWorker,
  Language,
  LatLng,
  Profession,
  cacheWorker,
} from '../services/api';
import { SelectCard } from '../components/SelectCard';
import { MapPicker } from '../components/MapPicker';
import { useThemePref, ThemeMode, useTheme } from '../theme/ThemeContext';
import { Sun, Moon, Smartphone, Camera, ChevronLeft, MapPin, Navigation } from 'lucide-react-native';
import { launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import LinearGradient from 'react-native-linear-gradient';
import { getCurrentLocation } from '../services/location';

type Props = {
  worker: CachedWorker;
  onClose: () => void;
  onUpdated: (w: CachedWorker) => void;
};

export function ProfileScreen({ worker, onClose, onUpdated }: Props) {
   const { colors, isDark } = useTheme();
   const [name, setName] = useState(worker.name);
   const [language, setLanguage] = useState<string | null>(worker.language);
   const [skills, setSkills] = useState<string[]>(worker.skills);
   const [imageUrl, setImageUrl] = useState<string | null>(worker.imageUrl);
   const [languages, setLanguages] = useState<Language[]>([]);
   const [professions, setProfessions] = useState<Profession[]>([]);
   const [saving, setSaving] = useState(false);
   const [uploading, setUploading] = useState(false);
   const [defaultLocation, setDefaultLocation] = useState<LatLng>({ lat: worker.location?.lat ?? 0, lng: worker.location?.lng ?? 0 });
   const [showMap, setShowMap] = useState(false);

  const profession = professions.find((p) => p.key === worker.profession);

  useEffect(() => {
    Promise.all([api.getLanguages(), api.getProfessions()])
      .then(([l, p]) => {
        setLanguages(l.languages);
        setProfessions(p.professions);
      })
      .catch(() => {});
  }, []);

  function toggleSkill(k: string) {
    setSkills((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  async function pickAndUpload() {
    launchImageLibrary(
      { mediaType: 'photo', includeBase64: true, quality: 0.5, maxWidth: 500, maxHeight: 500 },
      async (res: ImagePickerResponse) => {
        if (res.didCancel || res.errorCode) return;
        const asset = res.assets?.[0];
        if (asset?.base64) {
          setUploading(true);
          try {
            const up = await api.uploadImage(asset.base64);
            setImageUrl(up.url);
          } catch (e: any) {
            showAlert('Upload failed', e?.message || 'error');
          } finally {
            setUploading(false);
          }
        }
      }
    );
  }

   async function save() {
     if (!name.trim()) return showAlert('Name required');
     if (!language) return showAlert('Language required');
     setSaving(true);
     try {
       const updated = await api.updateProfile({
         name: name.trim(),
         language,
         skills,
         imageUrl,
         location: defaultLocation,
       });
       await cacheWorker(updated);
       onUpdated(updated);
       onClose();
     } catch (e: any) {
       showAlert('Could not save', e?.message || 'error');
     } finally {
       setSaving(false);
     }
   }

  return (
    <SafeScreen style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Profile Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile Picture */}
        <View style={styles.dpContainer}>
          <TouchableOpacity onPress={pickAndUpload} style={[styles.dpCircle, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl.startsWith('http') || imageUrl.startsWith('file') || imageUrl.startsWith('content') ? imageUrl : `http://10.0.2.2:3000${imageUrl}` }} style={styles.dpImage} />
            ) : uploading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={[styles.dpPlaceholder, { color: colors.textMuted }]}>+</Text>
            )}
            
            <View style={[styles.cameraBadge, { backgroundColor: colors.accent, borderColor: colors.bg }]}>
              <Camera size={16} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>FULL NAME</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={[styles.input, { color: colors.text }]}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          
          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />
          
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>PHONE NUMBER</Text>
            <Text style={[styles.readonly, { color: colors.text }]}>+91 {worker.phone}</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />
          
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>PROFESSION</Text>
            <View style={styles.rowBetween}>
              <Text style={[styles.readonly, { color: colors.text }]}>
                {profession ? profession.label : worker.profession || '—'}
              </Text>
            </View>
            <Text style={[styles.hintText, { color: colors.textFaint }]}>Contact support to change your profession</Text>
          </View>
        </View>

        {/* Appearance */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>APP APPEARANCE</Text>
        <ThemeToggle colors={colors} />

        {/* Language */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>COMMUNICATION LANGUAGE</Text>
        <View style={styles.langGrid}>
          {languages.map((l) => {
            const active = language === l.code;
            return (
              <TouchableOpacity
                key={l.code}
                onPress={() => setLanguage(l.code)}
                style={[
                  styles.langTile,
                  { backgroundColor: colors.card, borderColor: active ? colors.accent : colors.cardBorder }
                ]}
              >
                <Text style={[styles.langNative, { color: active ? colors.accent : colors.text }]}>{l.native}</Text>
                <Text style={[styles.langLabel, { color: colors.textMuted }]}>{l.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

         {/* Skills */}
         <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>YOUR SKILLS</Text>
         {profession ? (
           profession.skills.map((s) => (
             <SelectCard
               key={s.key}
               label={s.label}
               subtitle={`₹${s.basePrice} base + ₹${s.perKmRate}/km`}
               selected={skills.includes(s.key)}
               onPress={() => toggleSkill(s.key)}
             />
           ))
         ) : (
           <Text style={[styles.hintText, { color: colors.textFaint }]}>Set your profession first.</Text>
         )}

         {/* Default Location */}
         <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>DEFAULT LOCATION</Text>
         <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
           <Text style={[styles.hintText, { color: colors.textFaint, marginTop: 0, marginBottom: 12 }]}>
             Set a fallback location for finding nearby jobs when GPS is unavailable.
           </Text>
           {defaultLocation.lat !== 0 && defaultLocation.lng !== 0 ? (
             <View style={[styles.locPreview, { backgroundColor: isDark ? '#1e1b4b' : '#eef2ff' }]}>
               <MapPin size={18} color={isDark ? '#818cf8' : '#4f46e5'} />
               <View style={{ flex: 1 }}>
                 <Text style={[styles.locPreviewCoords, { color: isDark ? '#c7d2fe' : '#4338ca' }]}>
                   {defaultLocation.lat.toFixed(6)}, {defaultLocation.lng.toFixed(6)}
                 </Text>
                 <Text style={[styles.locPreviewHint, { color: isDark ? '#818cf8' : '#6366f1' }]}>Location set</Text>
               </View>
             </View>
           ) : (
             <View style={[styles.locPreview, { backgroundColor: isDark ? '#1c1917' : '#fef2f2' }]}>
               <Navigation size={18} color={isDark ? '#f87171' : '#ef4444'} />
               <Text style={[styles.locPreviewHint, { color: isDark ? '#f87171' : '#ef4444' }]}>No default location set</Text>
             </View>
           )}
           <TouchableOpacity
             style={[styles.mapBtn, { backgroundColor: isDark ? '#312e81' : '#4f46e5' }]}
             onPress={async () => {
               // Try to get current GPS location as initial for map
               if (defaultLocation.lat === 0 && defaultLocation.lng === 0) {
                 const gps = await getCurrentLocation();
                 if (gps) setDefaultLocation(gps);
               }
               setShowMap(true);
             }}
             activeOpacity={0.8}
           >
             <MapPin size={18} color="#fff" />
             <Text style={styles.mapBtnText}>
               {defaultLocation.lat !== 0 ? 'Change Location on Map' : 'Set Location on Map'}
             </Text>
           </TouchableOpacity>
         </View>

         {/* Map Picker Modal */}
         <Modal visible={showMap} animationType="slide" onRequestClose={() => setShowMap(false)}>
           <SafeScreen style={[styles.root, { backgroundColor: colors.bg }]}>
             <View style={styles.header}>
               <TouchableOpacity onPress={() => setShowMap(false)} style={styles.backBtn}>
                 <ChevronLeft size={28} color={colors.text} />
               </TouchableOpacity>
               <Text style={[styles.title, { color: colors.text }]}>Set Default Location</Text>
               <View style={{ width: 40 }} />
             </View>
             <Text style={[styles.hintText, { color: colors.textMuted, textAlign: 'center', paddingHorizontal: 20, marginBottom: 8 }]}>
               Drag the map to place pin on your work area
             </Text>
             <View style={{ flex: 1, padding: 12 }}>
               <MapPicker
                 initial={defaultLocation.lat !== 0 ? defaultLocation : null}
                 onConfirm={(loc) => {
                   setDefaultLocation(loc);
                   setShowMap(false);
                 }}
                 onCancel={() => setShowMap(false)}
               />
             </View>
           </SafeScreen>
         </Modal>

        {/* Save Button */}
        <TouchableOpacity
          onPress={save}
          disabled={saving}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={isDark ? ['#3b82f6', '#1d4ed8'] : ['#2563eb', '#1e40af']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveText}>Save Changes</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => Linking.openURL('mailto:support@crewli.app')}
          style={{ paddingVertical: 24, alignItems: 'center' }}
        >
          <Text style={[styles.hintText, { color: colors.textMuted }]}>Need help? support@crewli.app</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeScreen>
  );
}

function ThemeToggle({ colors }: any) {
  const mode = useThemePref((s) => s.mode);
  const setMode = useThemePref((s) => s.setMode);
  const opts: { key: ThemeMode; label: string; Icon: any }[] = [
    { key: 'system', label: 'System', Icon: Smartphone },
    { key: 'light', label: 'Light', Icon: Sun },
    { key: 'dark', label: 'Dark', Icon: Moon },
  ];
  return (
    <View style={[styles.themeRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      {opts.map(({ key, label, Icon }) => {
        const active = mode === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => setMode(key)}
            style={[styles.themeTile, active && { backgroundColor: colors.bg }]}
          >
            <Icon size={16} color={active ? colors.text : colors.textMuted} />
            <Text style={[styles.themeText, { color: active ? colors.text : colors.textMuted }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '800' },
  scroll: { padding: 20, paddingBottom: 60 },
  dpContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  dpCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  dpImage: { width: '100%', height: '100%' },
  dpPlaceholder: { fontSize: 40, fontWeight: '300' },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 2,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    marginBottom: 32,
  },
  fieldGroup: {
    paddingVertical: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    fontSize: 17,
    fontWeight: '500',
    padding: 0,
    margin: 0,
  },
  readonly: {
    fontSize: 17,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hintText: {
    fontSize: 13,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  themeRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    padding: 4,
    marginBottom: 32,
  },
  themeTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
  },
  themeText: { fontSize: 14, fontWeight: '600' },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginBottom: 32,
  },
  langTile: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  langNative: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  langLabel: { fontSize: 13 },
  saveBtn: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  locPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 14,
  },
  locPreviewCoords: { fontSize: 14, fontWeight: '700' },
  locPreviewHint: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  mapBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
