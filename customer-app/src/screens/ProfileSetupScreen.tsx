import { SafeScreen } from '../components/SafeScreen';
import { MapPicker } from '../components/MapPicker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { ArrowRight, User, MapPin, Navigation, Check } from 'lucide-react-native';
import { api } from '../services/api';
import { useApp } from '../store/app';
import { ensureAndGetLocation } from '../services/location';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';

type Props = { onDone: () => void };

export function ProfileSetupScreen({ onDone }: Props) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [locBusy, setLocBusy] = useState(false);
  const [locCaptured, setLocCaptured] = useState(false);
  const [capturedLoc, setCapturedLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(useApp.getState().imageUrl || null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  async function pickImage() {
    launchImageLibrary(
      { mediaType: 'photo', includeBase64: true, quality: 0.5, maxWidth: 500, maxHeight: 500 },
      (res: ImagePickerResponse) => {
        if (res.didCancel || res.errorCode) return;
        const asset = res.assets?.[0];
        if (asset?.uri && asset?.base64) {
          setImageUri(asset.uri);
          setImageBase64(asset.base64);
        }
      }
    );
  }

  async function openMapPicker() {
    setLocBusy(true);
    const loc = await ensureAndGetLocation();
    setLocBusy(false);
    if (loc) {
      setCapturedLoc(loc);
    }
    setShowMap(true);
  }

  function handleMapConfirm(loc: { lat: number; lng: number }) {
    useApp.getState().setLocation(loc);
    setCapturedLoc(loc);
    setLocCaptured(true);
    setShowMap(false);
  }

  async function save() {
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!address.trim()) { setError('Please enter your address'); return; }
    if (!locCaptured && !useApp.getState().location) { setError('Please capture your exact delivery location'); return; }
    setBusy(true);
    setError(null);
    try {
      let finalImageUrl = useApp.getState().imageUrl;
      if (imageBase64) {
        const up = await api.uploadImage(imageBase64);
        finalImageUrl = up.url;
      }

      useApp.getState().setName(name.trim());
      useApp.getState().setAddress(address.trim());
      useApp.getState().setImageUrl(finalImageUrl || null);

      // Auto-save as first saved address
      const loc = capturedLoc || useApp.getState().location;
      const addrId = `addr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const savedAddrObj = {
        id: addrId,
        label: 'Home',
        address: address.trim(),
        location: loc,
      };
      
      useApp.getState().addSavedAddress(savedAddrObj);
      useApp.getState().selectAddress(addrId);

      const customerId = useApp.getState().customerId;
      if (customerId) {
        await api.updateProfile(customerId, {
          name: name.trim(),
          address: address.trim(),
          location: loc || undefined,
          imageUrl: finalImageUrl || null,
          savedAddresses: useApp.getState().savedAddresses,
        });
      }

      onDone();
    } catch (e: any) {
      setError(e?.message || 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  // ──── MAP PICKER FULLSCREEN ────
  if (showMap) {
    return (
      <View style={[styles.root, { backgroundColor: '#f8fafc' }]}>
        <SafeScreen style={{ flex: 1 }}>
          <View style={styles.mapHeader}>
            <MapPin size={22} color="#311090" />
            <Text style={styles.mapTitle}>Pin your location</Text>
          </View>
          <Text style={styles.mapSub}>
            Move the map to place the pin on your exact location
          </Text>
          <View style={{ flex: 1, margin: 12 }}>
            <MapPicker
              initial={capturedLoc}
              onConfirm={handleMapConfirm}
              onCancel={() => setShowMap(false)}
            />
          </View>
        </SafeScreen>
      </View>
    );
  }

  // ──── PROFILE FORM ────
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#FDFBFF', '#F4F0FF', '#EBE4FF']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, zIndex: 10 }}
      >
        <SafeScreen style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.logoContainer}>
              <Image source={require('../images/main.png')} style={styles.logo} resizeMode="contain" />
            </View>

            <Text style={styles.title}>Almost there!{'\n'}Tell us about you.</Text>
            <Text style={styles.subtitle}>
              We'll use this to personalize your experience and help workers reach you.
            </Text>

            {/* Profile Image Picker */}
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
              {imageUri && !imgError ? (
                <Image
                  source={{ uri: imageUri.startsWith('http') || imageUri.startsWith('file') || imageUri.startsWith('content') ? imageUri : `http://10.0.2.2:3000${imageUri}` }}
                  style={styles.imagePreview}
                  onError={() => setImgError(true)}
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  {name.trim() ? (
                    <Text style={styles.imagePlaceholderLetter}>{name.trim()[0].toUpperCase()}</Text>
                  ) : (
                    <User size={32} color="#311090" />
                  )}
                </View>
              )}
              <View style={styles.imageEditBadge}>
                <Text style={styles.imageEditText}>Edit</Text>
              </View>
            </TouchableOpacity>

            {/* Name Field */}
            <Text style={styles.fieldLabel}>YOUR NAME</Text>
            <View style={styles.inputContainer}>
              <User size={18} color="#9CA3AF" style={{ marginLeft: 14 }} />
              <TextInput
                value={name}
                onChangeText={(t) => { setName(t); setError(null); }}
                placeholder="Enter your full name"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                autoCapitalize="words"
              />
            </View>

            {/* Address Field */}
            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>YOUR ADDRESS</Text>
            <View style={[styles.inputContainer, { alignItems: 'flex-start', minHeight: 90 }]}>
              <MapPin size={18} color="#9CA3AF" style={{ marginLeft: 14, marginTop: 16 }} />
              <TextInput
                value={address}
                onChangeText={(t) => { setAddress(t); setError(null); }}
                placeholder="Enter your home / work address"
                placeholderTextColor="#9CA3AF"
                style={[styles.input, { paddingVertical: 16, textAlignVertical: 'top' }]}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Location Picker Button */}
            <TouchableOpacity
              style={[styles.locationBtn, locCaptured && styles.locationBtnDone]}
              onPress={openMapPicker}
              disabled={locBusy}
            >
              {locBusy ? (
                <ActivityIndicator size="small" color="#311090" />
              ) : locCaptured ? (
                <Check size={16} color="#10b981" />
              ) : (
                <Navigation size={14} color="#311090" />
              )}
              <Text style={[styles.locationBtnText, locCaptured && { color: '#10b981' }]}>
                {locCaptured
                  ? `Location set (${capturedLoc?.lat.toFixed(4)}, ${capturedLoc?.lng.toFixed(4)})`
                  : 'Pick exact location on map'}
              </Text>
            </TouchableOpacity>

            {error ? (
              <View style={styles.errorWrap}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.btn, busy && { opacity: 0.7 }]}
              onPress={save}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.btnContent}>
                  <Text style={styles.btnText}>Save & Continue</Text>
                  <ArrowRight size={20} color="#fff" style={{ position: 'absolute', right: 24 }} />
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeScreen>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 60,
    alignItems: 'center',
  },
  logoContainer: { marginBottom: 28, alignItems: 'center' },
  logo: { width: 180, height: 60 },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1F1245',
    textAlign: 'center',
    lineHeight: 42,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  imagePicker: {
    alignSelf: 'center',
    marginBottom: 32,
    position: 'relative',
  },
  imagePlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#311090',
  },
  imagePlaceholderLetter: {
    fontSize: 34,
    fontWeight: '800',
    color: '#311090',
  },
  imagePreview: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#311090',
  },
  imageEditBadge: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    backgroundColor: '#311090',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  imageEditText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  fieldLabel: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8D4E5',
    backgroundColor: '#FAFAFA',
    width: '100%',
    minHeight: 56,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 0,
    color: '#111827',
    height: 56,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#f0edff',
  },
  locationBtnDone: {
    backgroundColor: '#ecfdf5',
  },
  locationBtnText: {
    color: '#311090',
    fontSize: 13,
    fontWeight: '700',
  },
  errorWrap: {
    marginTop: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
  },
  errorText: { color: '#dc2626', fontSize: 13, fontWeight: '500', textAlign: 'center' },
  btn: {
    marginTop: 28,
    borderRadius: 12,
    backgroundColor: '#311090',
    width: '100%',
    height: 56,
    justifyContent: 'center',
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // Map step
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 16,
  },
  mapTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F1245',
  },
  mapSub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 4,
  },
});
