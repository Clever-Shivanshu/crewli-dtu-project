import { showAlert } from '../store/alert';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
    Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { AddOn, api, Skill, SubProblem } from '../services/api';
import { useApp } from '../store/app';

type Props = {
  visible: boolean;
  subProblem: SubProblem | null;
  skill: Skill | null;
  addOns: AddOn[];
  onClose: () => void;
  onBooked: (jobId: string) => void;
};

export function ConfirmSheet({ visible, subProblem, skill, addOns, onClose, onBooked }: Props) {
  const { colors } = useTheme();
  const location = useApp((s) => s.location);
  const address = useApp((s) => s.address);
  const phone = useApp((s) => s.phone);
  const customerName = useApp((s) => s.name);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const total = useMemo(() => {
    if (!skill) return 0;
    const extras = addOns
      .filter((a) => selectedAddOns.includes(a.id))
      .reduce((s, a) => s + a.price, 0);
    return skill.basePrice + extras;
  }, [skill, addOns, selectedAddOns]);

  function toggle(id: string) {
    setSelectedAddOns((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  }

  async function book() {
    if (!subProblem) return;
    if (!location) {
      showAlert('Location needed', 'Please set your location on the home screen first.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.createJob({
        subProblemId: subProblem.id,
        customerLocation: location,
        customerId: useApp.getState().customerId,
        customerPhone: phone,
        customerName,
        address,
        addOns: selectedAddOns,
      });
      useApp.getState().setActiveJob(res.jobId);
      onBooked(res.jobId);
    } catch (e: any) {
      showAlert('Could not create job', e?.message || 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.cardBorder }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.step, { color: colors.textFaint }]}>CONFIRM BOOKING</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <X size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>{subProblem?.title || ''}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Starting from ₹{skill?.basePrice ?? '—'} · +₹{skill?.perKmRate ?? '—'}/km travel
        </Text>

        {addOns.map((a) => {
          const on = selectedAddOns.includes(a.id);
          return (
            <TouchableOpacity
              key={a.id}
              style={[
                styles.addOnRow,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                on && { borderColor: colors.accent, backgroundColor: colors.accent + '18' },
              ]}
              onPress={() => toggle(a.id)}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.check,
                  { borderColor: colors.textFaint },
                  on && { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}
              >
                {on ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
              </View>
              <Text style={[styles.addOnLabel, { color: colors.text }]}>{a.label}</Text>
              <Text style={[styles.addOnPrice, { color: colors.textMuted }]}>+₹{a.price}</Text>
            </TouchableOpacity>
          );
        })}

        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Base total</Text>
          <Text style={[styles.totalValue, { color: colors.text }]}>₹{total}</Text>
        </View>
        <Text style={[styles.disclaim, { color: colors.textFaint }]}>
          Final price includes travel distance once a worker is matched.
        </Text>

        <TouchableOpacity
          style={[styles.bookBtn, { backgroundColor: colors.accent }, busy && { opacity: 0.7 }]}
          onPress={book}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.bookBtnText}>Confirm & find a worker</Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 24,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  step: { fontSize: 12, letterSpacing: 1 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 4, marginBottom: 20 },

  addOnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addOnLabel: { fontSize: 15, flex: 1 },
  addOnPrice: { fontSize: 14, fontWeight: '600' },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 8,
  },
  totalLabel: { fontSize: 14 },
  totalValue: { fontSize: 28, fontWeight: '800' },
  disclaim: { fontSize: 12, marginTop: 4, marginBottom: 20 },

  bookBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  bookBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
