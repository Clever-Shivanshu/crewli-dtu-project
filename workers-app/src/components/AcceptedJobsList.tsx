import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Briefcase, MapPin, Clock, Wallet, ChevronRight } from 'lucide-react-native';
import { api, Job } from '../services/api';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  limit?: number;
  onViewAll?: () => void;
};

export function AcceptedJobsList({ limit, onViewAll }: Props) {
  const { colors } = useTheme();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.myJobs();
      setJobs(res.jobs);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'error');
    }
  }, []);

  useEffect(() => {
    load();
    // Poll every 60s while visible so the list stays fresh.
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (jobs === null) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.header}>
          <Briefcase size={18} color={colors.textMuted} />
          <Text style={[styles.title, { color: colors.textMuted }]}>Your accepted jobs</Text>
        </View>
        <ActivityIndicator style={{ marginTop: 16 }} color={colors.text} />
      </View>
    );
  }

  const displayJobs = limit ? jobs.slice(0, limit) : jobs;
  const hasMore = limit ? jobs.length > limit : false;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={styles.header}>
        <Briefcase size={18} color={colors.textMuted} />
        <Text style={[styles.title, { color: colors.textMuted }]}>Your accepted jobs</Text>
        <Text
          style={[
            styles.count,
            { backgroundColor: colors.input, color: colors.link },
          ]}
        >
          {jobs.length}
        </Text>
      </View>

      {error ? <Text style={[styles.err, { color: colors.danger }]}>{error}</Text> : null}

      {jobs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.text }]}>No accepted jobs yet.</Text>
          <Text style={[styles.emptySub, { color: colors.textFaint }]}>
            Turn ON WORK above and you'll start receiving offers.
          </Text>
        </View>
      ) : (
        <View>
          {displayJobs.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
          {hasMore && (
            <TouchableOpacity
              style={styles.viewAllBtn}
              onPress={onViewAll}
              activeOpacity={0.8}
            >
              <Text style={[styles.viewAllText, { color: colors.link }]}>
                View All ({jobs.length} jobs)
              </Text>
              <ChevronRight size={16} color={colors.link} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function JobCard({ job }: { job: Job }) {
  const { colors, isDark } = useTheme();
  const price = job.finalPrice ?? job.basePrice;
  const when = new Date(job.acceptedAt || job.createdAt);
  return (
    <View
      style={[
        styles.jobCard,
        { backgroundColor: isDark ? '#0b1220' : '#f8fafc', borderColor: colors.cardBorder },
      ]}
    >
      <View style={styles.jobHead}>
        <Text style={[styles.jobType, { color: colors.text }]}>{job.jobType}</Text>
        <StatusPill status={job.status} />
      </View>
      {job.subProblemTitle ? (
        <Text style={[styles.jobSub, { color: colors.textMuted }]}>{job.subProblemTitle}</Text>
      ) : null}
      {job.address ? (
        <View style={styles.row}>
          <MapPin size={13} color={colors.textMuted} />
          <Text style={[styles.rowText, { color: colors.textMuted }]} numberOfLines={2}>
            {job.address}
          </Text>
        </View>
      ) : null}
      <View style={styles.row}>
        <Wallet size={13} color={colors.textMuted} />
        <Text style={[styles.rowText, { color: colors.textMuted }]}>
          {job.finalPrice != null ? `₹${price}` : `₹${price} base + ₹${job.perKmRate}/km`}
        </Text>
      </View>
      <View style={styles.row}>
        <Clock size={13} color={colors.textMuted} />
        <Text style={[styles.rowText, { color: colors.textMuted }]}>{formatTime(when)}</Text>
      </View>
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const { isDark } = useTheme();
  const darkMap: Record<string, { bg: string; fg: string; label: string }> = {
    accepted: { bg: '#052e1a', fg: '#22c55e', label: 'Accepted' },
    arrived: { bg: '#1e1b4b', fg: '#818cf8', label: 'Arrived' },
    completed: { bg: '#0f172a', fg: '#9ca3af', label: 'Completed' },
    paid: { bg: '#052e1a', fg: '#4ade80', label: 'Paid' },
    cancelled: { bg: '#3f1d1d', fg: '#f87171', label: 'Cancelled' },
    pending: { bg: '#1f1608', fg: '#f59e0b', label: 'Pending' },
    expired: { bg: '#1f1608', fg: '#f59e0b', label: 'Expired' },
  };
  const lightMap: Record<string, { bg: string; fg: string; label: string }> = {
    accepted: { bg: '#dcfce7', fg: '#15803d', label: 'Accepted' },
    arrived: { bg: '#e0e7ff', fg: '#4338ca', label: 'Arrived' },
    completed: { bg: '#f1f5f9', fg: '#475569', label: 'Completed' },
    paid: { bg: '#dcfce7', fg: '#15803d', label: 'Paid' },
    cancelled: { bg: '#fee2e2', fg: '#b91c1c', label: 'Cancelled' },
    pending: { bg: '#fef3c7', fg: '#b45309', label: 'Pending' },
    expired: { bg: '#fef3c7', fg: '#b45309', label: 'Expired' },
  };
  const s = (isDark ? darkMap : lightMap)[status] || (isDark ? darkMap.accepted : lightMap.accepted);
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <Text style={[styles.pillText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

function formatTime(d: Date) {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 13, flex: 1 },
  count: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  err: { fontSize: 12, marginTop: 8 },
  empty: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { fontSize: 15, fontWeight: '600' },
  emptySub: { fontSize: 12, marginTop: 4, textAlign: 'center' },
  jobCard: {
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    gap: 6,
    borderWidth: 1,
  },
  jobHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  jobType: { fontSize: 16, fontWeight: '700' },
  jobSub: { fontSize: 13, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowText: { fontSize: 13, flex: 1 },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '700' },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 10,
  },
  viewAllText: { fontSize: 14, fontWeight: '700' },
});
