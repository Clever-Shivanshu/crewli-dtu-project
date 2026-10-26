import { SafeScreen } from '../components/SafeScreen';
import { showAlert } from '../store/alert';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ArrowRight,
  Brush,
  Bug,
  Droplets,
  Hammer,
  MapPin,
  Square,
  Wrench,
  Zap,
  LucideIcon,
  Bot,
  User
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { api, Catalog, Problem } from '../services/api';
import { useApp } from '../store/app';

const CATEGORY_META: Record<string, { icon: LucideIcon; color: string }> = {
  electrical: { icon: Zap, color: '#f59e0b' },
  plumbing: { icon: Droplets, color: '#3b82f6' },
  carpentry: { icon: Hammer, color: '#a855f7' },
  paint: { icon: Brush, color: '#ec4899' },
  pest: { icon: Bug, color: '#22c55e' },
  glass: { icon: Square, color: '#06b6d4' },
  handy: { icon: Wrench, color: '#ef4444' },
};

const BENTO_CONFIG: Record<string, { bg: string; iconColor: string; height: number; image: any }> = {
  electrical: { bg: '#FDE68A', iconColor: '#D97706', height: 230, image: require('../images/switch.png') },
  plumbing: { bg: '#BFDBFE', iconColor: '#2563EB', height: 210, image: require('../images/tap.png') },
  carpentry: { bg: '#E7C8A0', iconColor: '#92400E', height: 170, image: require('../images/carp.png') },
  pest: { bg: '#BBF7D0', iconColor: '#16A34A', height: 190, image: require('../images/pest.png') },
  paint: { bg: '#CCFBF1', iconColor: '#0D9488', height: 190, image: require('../images/paint.png') },
  glass: { bg: '#E9D5FF', iconColor: '#9333EA', height: 190, image: require('../images/win.png') },
  handy: { bg: '#FECDD3', iconColor: '#E11D48', height: 140, image: require('../images/handy.png') },
};

type Props = {
  onCategory: (problem: Problem) => void;
  onAI?: () => void;
  onProfile?: () => void;
  onAddress?: () => void;
};

export function HomeScreen({ onCategory, onAI, onProfile, onAddress }: Props) {
  const { colors, isDark } = useTheme();
  const location = useApp((s) => s.location);
  const address = useApp((s) => s.address);
  const savedAddresses = useApp((s) => s.savedAddresses);
  const selectedId = useApp((s) => s.selectedAddressId);
  const phone = useApp((s) => s.phone);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [eta, setEta] = useState<{ etaMin: number | null; available: boolean } | null>(null);

  useEffect(() => {
    api.getCatalog()
      .then(setCatalog)
      .catch((e) => showAlert('Could not load catalog', e?.message || ''));
  }, []);

  useEffect(() => {
    if (!location) { setEta(null); return; }
    let alive = true;
    api.getNearestEta(location.lat, location.lng)
      .then((r) => { if (alive) setEta(r); })
      .catch(() => { if (alive) setEta(null); });
    return () => { alive = false; };
  }, [location?.lat, location?.lng]);

  const etaText = (() => {
    if (!location) return 'Set your location to see arrival time';
    if (!eta) return 'Checking worker availability...';
    if (!eta.available || eta.etaMin == null) {
      return 'No workers available near you right now';
    }
    return `Time of arrival of worker in under ${eta.etaMin} min`;
  })();

  const renderBentoCard = (p: Problem, isFullWidth = false) => {
    const meta = CATEGORY_META[p.category] || { icon: Wrench, color: colors.accent };
    const bento = BENTO_CONFIG[p.category] || { bg: colors.card, iconColor: colors.accent, height: 180, image: null };
    const Icon = meta.icon;

    return (
      <TouchableOpacity
        key={p.id}
        style={[
          styles.bentoCard,
          { backgroundColor: bento.bg, height: bento.height },
          isFullWidth && { width: '100%' }
        ]}
        onPress={() => onCategory(p)}
        activeOpacity={0.85}
      >
        {bento.image && (
          <Image source={bento.image} style={[styles.bentoImage, isFullWidth && styles.bentoImageFull]} />
        )}
        <View style={{ flex: 1, zIndex: 2 }}>
          <View style={styles.bentoIconWrapper}>
            <Icon size={22} color={bento.iconColor} strokeWidth={2.5} />
          </View>
          <Text style={[styles.bentoTitle, { color: '#111827' }]}>{p.title}</Text>
        </View>
        <View style={styles.bentoArrow}>
          <ArrowRight size={16} color="#4B5563" />
        </View>
      </TouchableOpacity>
    );
  };

  const bentoLeft: Problem[] = [];
  const bentoRight: Problem[] = [];
  let bentoBottom: Problem | null = null;

  if (catalog) {
    const ORDER = ['electrical', 'plumbing', 'carpentry', 'pest', 'paint', 'glass', 'handy'];
    const sortedProblems = catalog.problems.slice().sort((a, b) => {
      const idxA = ORDER.indexOf(a.category);
      const idxB = ORDER.indexOf(b.category);
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });

    sortedProblems.forEach((p, i) => {
      if (p.category === 'handy' || i === 6) {
        bentoBottom = p;
      } else if (i % 2 === 0) {
        bentoLeft.push(p);
      } else {
        bentoRight.push(p);
      }
    });
  }

  return (
    <SafeScreen style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topRow}>
          <Image source={require('../images/main.png')} style={styles.logoSmall} resizeMode="contain" />
          <View style={{ flex: 1 }} />
          <View style={styles.headerRight}>
            {onProfile && (
              <TouchableOpacity onPress={onProfile} style={[styles.profileBtn, { backgroundColor: colors.accent }]}>
                <User size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={[styles.locIcon, { backgroundColor: colors.accent + '22' }]}>
            <MapPin size={18} color={colors.accent} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.locLabel, { color: colors.textFaint }]}>
              {savedAddresses.find(a => a.id === selectedId)?.label || 'Service at'}
            </Text>
            <Text style={[styles.locText, { color: colors.text }]} numberOfLines={1}>
              {address || (location ? 'Current Location Set' : 'Tap to set address')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onAddress}
            style={[styles.locBtn, { backgroundColor: colors.accent + '22' }]}
          >
            <Text style={[styles.locBtnText, { color: colors.accent }]}>
              {savedAddresses.length > 0 ? 'Manage' : 'Add'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.etaBar, { backgroundColor: colors.accent + '15' }]}>
          <Text style={[styles.etaText, { color: colors.accent }]}>{etaText}</Text>
        </View>

        {/* AI Banner Moved to Bottom */}

        <View style={styles.headerWrap}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>What's your Problem?</Text>
          <Text style={[styles.sectionSub, { color: colors.textFaint }]}>Select a category to tell us more</Text>
        </View>

        {!catalog ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
        ) : (
          <View style={styles.bentoWrapper}>
            <View style={styles.bentoContainer}>
              <View style={styles.bentoColLeft}>
                {bentoLeft.map(p => renderBentoCard(p))}
              </View>
              <View style={styles.bentoColRight}>
                {bentoRight.map(p => renderBentoCard(p))}
              </View>
            </View>
            {bentoBottom && renderBentoCard(bentoBottom, true)}
          </View>
        )}

        {onAI && (
          <View style={styles.aiBannerWrapper}>
            <View style={styles.aiBannerContentWrap}>
              <Text style={styles.aiBannerTitleMain}>Feeling confused{'\n'}which crew to connect?</Text>
              <Text style={styles.aiBannerSubMain}>Ask Crewli AI and get matched</Text>
              <TouchableOpacity style={styles.aiBannerBtnMain} onPress={onAI} activeOpacity={0.9}>
                <Image source={require('../images/ai-home.png')} style={{ width: 16, height: 16, tintColor: '#fff', marginRight: 8, display: 'none' }} />
                <Bot size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.aiBannerBtnTextMain}>Ask Crewli AI</Text>
                <ArrowRight size={18} color="#fff" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
            <View style={styles.aiBannerImgWrap}>
              <Image source={require('../images/ai-home.png')} style={styles.aiBannerImgMain} resizeMode="contain" />
            </View>
          </View>
        )}

        <Image source={require('../images/footer.png')} style={styles.footer} resizeMode="cover" />
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLeft: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoSmall: {
    width: 140,
    height: 38,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  locIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locLabel: { fontSize: 11 },
  locText: { fontSize: 14, fontWeight: '600', marginTop: 1 },
  locBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  locBtnText: { fontSize: 12, fontWeight: '700' },
  etaBar: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
  },
  etaText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  aiBannerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F5FF',
    borderRadius: 24,
    padding: 20,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    overflow: 'hidden',
  },
  aiBannerContentWrap: {
    flex: 1.2,
    zIndex: 2,
  },
  aiBannerTitleMain: { color: '#1E1B4B', fontSize: 22, fontWeight: '800', lineHeight: 28 },
  aiBannerSubMain: { color: '#6B7280', fontSize: 14, marginTop: 8, lineHeight: 20 },
  aiBannerBtnMain: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#311090',
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 16,
  },
  aiBannerBtnTextMain: { color: '#fff', fontSize: 15, fontWeight: '700' },
  aiBannerImgWrap: {
    flex: 0.8,
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 140,
  },
  aiBannerImgMain: {
    width: 180,
    height: 180,
    position: 'absolute',
    right: -20,
    bottom: -20,
  },
  headerWrap: { marginTop: 24, marginBottom: 16 },
  sectionTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  sectionSub: { fontSize: 14, marginTop: 4 },
  bentoWrapper: { paddingBottom: 20 },
  bentoContainer: { flexDirection: 'row' },
  bentoColLeft: { flex: 1, marginRight: 6 },
  bentoColRight: { flex: 1, marginLeft: 6 },
  bentoCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  bentoIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  bentoTitle: { fontSize: 17, fontWeight: '800', lineHeight: 22, marginTop: 12, maxWidth: '85%', zIndex: 2 },
  bentoArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  bentoImage: {
    position: 'absolute',
    right: -10,
    bottom: -10,
    width: '65%',
    height: '75%',
    resizeMode: 'contain',
    zIndex: 1,
  },
  bentoImageFull: {
    position: 'absolute',
    right: 10,
    bottom: -10,
    width: '40%',
    height: '110%',
    resizeMode: 'contain',
    zIndex: 1,
  },

  footer: {
    width: '100%',
    height: 300,
    marginTop: 20,
  },
});
